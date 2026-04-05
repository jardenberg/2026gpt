import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Spinner, TextareaAutosize } from '@librechat/client';
import { FileText, RefreshCw, SendHorizontal, ShieldCheck, Upload } from 'lucide-react';
import {
  bootstrapPolicyAnalystAuth,
  fetchPolicyAnalystConfig,
  fetchPolicyAnalystDocument,
  queryPolicyAnalystDocument,
  readStoredPolicyAnalystAnswers,
  readStoredPolicyAnalystDocs,
  uploadPolicyAnalystDocument,
  writeStoredPolicyAnalystAnswers,
  writeStoredPolicyAnalystDocs,
} from '~/utils/policyAnalyst';

const starterPrompts = [
  'Summarize the purpose, scope, and key obligations in this policy.',
  'Who is responsible for compliance and what are their specific duties?',
  'What exceptions, local overrides, or escalations does this policy allow?',
  'List the top five things an employee or manager must actually do under this policy.',
];

export default function PolicyAnalystRoute() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState(readStoredPolicyAnalystDocs);
  const [answers, setAnswers] = useState(readStoredPolicyAnalystAnswers);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(() => readStoredPolicyAnalystDocs()[0]?.docId ?? null);
  const [question, setQuestion] = useState('');
  const authBootstrapQuery = useQuery({
    queryKey: ['policy-analyst-auth'],
    queryFn: bootstrapPolicyAnalystAuth,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const authToken = authBootstrapQuery.data ?? null;

  const configQuery = useQuery({
    queryKey: ['policy-analyst-config', authToken],
    queryFn: () => fetchPolicyAnalystConfig(authToken),
    staleTime: 60_000,
    retry: false,
    enabled: !authBootstrapQuery.isLoading,
  });

  useEffect(() => {
    writeStoredPolicyAnalystDocs(documents);
  }, [documents]);

  useEffect(() => {
    writeStoredPolicyAnalystAnswers(answers);
  }, [answers]);

  useEffect(() => {
    if (!selectedDocId && documents[0]?.docId) {
      setSelectedDocId(documents[0].docId);
    }
  }, [documents, selectedDocId]);

  const selectedDoc = useMemo(
    () => documents.find((doc) => doc.docId === selectedDocId) ?? null,
    [documents, selectedDocId],
  );

  const visibleAnswers = useMemo(
    () => answers.filter((answer) => answer.docId === selectedDocId).slice().reverse(),
    [answers, selectedDocId],
  );

  const mergeDocument = (nextDoc: {
    docId: string;
    filename?: string;
    title: string | null;
    status: string;
    retrievalReady: boolean;
    outline: {
      nodeId: string;
      title: string;
      pageIndex: number | null;
      children: { nodeId: string; title: string; pageIndex: number | null; children: [] }[];
    }[];
  }) => {
    setDocuments((current) => {
      const existing = current.find((doc) => doc.docId === nextDoc.docId);
      const merged = {
        docId: nextDoc.docId,
        filename: nextDoc.filename ?? existing?.filename ?? nextDoc.title ?? nextDoc.docId,
        title: nextDoc.title,
        status: nextDoc.status,
        retrievalReady: nextDoc.retrievalReady,
        outline: nextDoc.outline,
      };

      if (!existing) {
        return [merged, ...current];
      }

      return current.map((doc) => (doc.docId === nextDoc.docId ? merged : doc));
    });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPolicyAnalystDocument(file, authToken),
    onSuccess: (doc) => {
      mergeDocument(doc);
      setSelectedDocId(doc.docId);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (docId: string) => fetchPolicyAnalystDocument(docId, authToken),
    onSuccess: (doc) => {
      mergeDocument(doc);
    },
  });

  const queryMutation = useMutation({
    mutationFn: ({ docId, prompt }: { docId: string; prompt: string }) =>
      queryPolicyAnalystDocument(docId, prompt, authToken),
    onSuccess: (result, variables) => {
      setAnswers((current) => [
        ...current,
        {
          id: `${variables.docId}:${Date.now()}`,
          docId: variables.docId,
          question: variables.prompt,
          answer: result.answer,
          citations: result.citations,
          createdAt: new Date().toISOString(),
        },
      ]);
      setQuestion('');
    },
  });

  useEffect(() => {
    if (selectedDocId && !selectedDoc?.outline?.length && configQuery.data?.enabled) {
      refreshMutation.mutate(selectedDocId);
    }
  }, [selectedDocId, selectedDoc?.outline?.length, configQuery.data?.enabled]);

  const askQuestion = (prompt: string) => {
    if (!selectedDocId || !prompt.trim()) {
      return;
    }

    queryMutation.mutate({
      docId: selectedDocId,
      prompt: prompt.trim(),
    });
  };

  if (authBootstrapQuery.isLoading || configQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (authBootstrapQuery.isError || configQuery.isError) {
    return (
      <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center px-6 py-12">
        <div className="w-full rounded-[32px] border border-[#d9b4b4] bg-[#fff5f5] p-10 text-[#7d2d2d] shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em]">
            Policy Analyst
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Policy Analyst configuration is temporarily unavailable.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7">
            The workflow did not complete its authenticated startup check. This is different from
            the workflow being intentionally disabled.
          </p>
        </div>
      </div>
    );
  }

  if (!configQuery.data?.enabled) {
    return (
      <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center px-6 py-12">
        <div className="w-full rounded-[32px] border border-black/10 bg-white/80 p-10 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b6949]">
            Policy Analyst
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#17130e]">
            This workflow is not enabled in this environment.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5b4d40]">
            Policy Analyst depends on a staging-only PageIndex configuration. Once that runtime
            configuration is available, this workspace will activate automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f6f1e8] px-6 py-8 text-[#17130e]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="rounded-[36px] border border-black/10 bg-white/80 px-8 py-8 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d7c2ab] bg-[#f8efe5] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b6949]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Staging workflow
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#17130e]">
                Policy Analyst
              </h1>
              <p className="mt-3 text-base leading-7 text-[#5b4d40]">
                Upload one policy PDF, ask specific questions, and get concise grounded answers
                with page citations. This uses a dedicated PageIndex path and leaves the normal
                file-search workflow untouched.
              </p>
            </div>
            <Button className="rounded-full" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Upload policy PDF
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  uploadMutation.mutate(file);
                }
                event.currentTarget.value = '';
              }}
            />
          </div>
          {(uploadMutation.error || refreshMutation.error || queryMutation.error) && (
            <div className="mt-4 rounded-2xl border border-[#d9b4b4] bg-[#fff5f5] px-4 py-3 text-sm text-[#7d2d2d]">
              {uploadMutation.error?.message ||
                refreshMutation.error?.message ||
                queryMutation.error?.message}
            </div>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="rounded-[32px] border border-black/10 bg-white/80 p-5 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b6949]">
                    Documents
                  </div>
                  <h2 className="mt-2 text-xl font-semibold">Current session</h2>
                </div>
                {refreshMutation.isLoading && <Spinner className="h-4 w-4 text-[#8b6949]" />}
              </div>

              <div className="mt-4 space-y-3">
                {documents.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#d8c8b7] bg-[#faf4ec] px-4 py-5 text-sm leading-6 text-[#6a5948]">
                    No policies uploaded yet. Start with one PDF and ask concrete questions about
                    scope, obligations, roles, or exceptions.
                  </div>
                ) : (
                  documents.map((doc) => {
                    const selected = doc.docId === selectedDocId;
                    return (
                      <button
                        key={doc.docId}
                        className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                          selected
                            ? 'border-[#17130e] bg-[#17130e] text-[#f6f1e8]'
                            : 'border-[#e3d5c8] bg-[#faf4ec] text-[#2a221a] hover:border-[#c9b39b]'
                        }`}
                        onClick={() => setSelectedDocId(doc.docId)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <FileText className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium leading-5">
                              {doc.title ?? doc.filename}
                            </div>
                            <div
                              className={`mt-1 text-xs ${
                                selected ? 'text-[#eadfce]' : 'text-[#786858]'
                              }`}
                            >
                              {doc.filename}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-[32px] border border-black/10 bg-white/80 p-5 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b6949]">
                Starter prompts
              </div>
              <div className="mt-4 space-y-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    className="w-full rounded-2xl border border-[#e3d5c8] bg-[#faf4ec] px-4 py-3 text-left text-sm leading-6 text-[#3e3328] transition hover:border-[#c9b39b]"
                    onClick={() => askQuestion(prompt)}
                    disabled={!selectedDocId || queryMutation.isLoading}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <main className="space-y-6">
            <section className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b6949]">
                    Active document
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    {selectedDoc?.title ?? selectedDoc?.filename ?? 'Select a policy'}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#5b4d40]">
                    {selectedDoc
                      ? 'Ask narrow policy questions. This MVP is optimized for one document at a time.'
                      : 'Upload or select one document to begin.'}
                  </p>
                </div>
                {selectedDoc && (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => refreshMutation.mutate(selectedDoc.docId)}
                    disabled={refreshMutation.isLoading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh outline
                  </Button>
                )}
              </div>

              <div className="mt-5 rounded-[28px] border border-[#e3d5c8] bg-[#faf4ec] p-4">
                <TextareaAutosize
                  minRows={4}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={
                    selectedDoc
                      ? 'Ask a policy question, for example: What must managers do under this policy?'
                      : 'Select a policy before asking a question.'
                  }
                  className="w-full resize-none border-0 bg-transparent text-sm leading-7 text-[#1d1813] outline-none placeholder:text-[#8c7d6f]"
                  disabled={!selectedDoc || queryMutation.isLoading}
                />
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="text-xs text-[#7d6e61]">
                    PDF-first. Grounded answers. Page citations.
                  </div>
                  <Button
                    className="rounded-full"
                    onClick={() => askQuestion(question)}
                    disabled={!selectedDoc || !question.trim() || queryMutation.isLoading}
                  >
                    {queryMutation.isLoading ? (
                      <Spinner className="mr-2 h-4 w-4" />
                    ) : (
                      <SendHorizontal className="mr-2 h-4 w-4" />
                    )}
                    Ask Policy Analyst
                  </Button>
                </div>
              </div>
            </section>

            {selectedDoc?.outline?.length ? (
              <section className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b6949]">
                  Outline
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {selectedDoc.outline.map((node) => (
                    <div
                      key={node.nodeId}
                      className="rounded-[24px] border border-[#e3d5c8] bg-[#faf4ec] px-4 py-4"
                    >
                      <div className="text-sm font-medium text-[#1f1a14]">{node.title}</div>
                      {node.pageIndex != null && (
                        <div className="mt-1 text-xs text-[#7d6e61]">Page {node.pageIndex}</div>
                      )}
                      {node.children.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-[#eaded2] pt-3">
                          {node.children.map((child) => (
                            <div key={child.nodeId} className="text-xs leading-5 text-[#5d5043]">
                              {child.title}
                              {child.pageIndex != null ? ` · p.${child.pageIndex}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b6949]">
                Answers
              </div>
              <div className="mt-4 space-y-4">
                {visibleAnswers.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#d8c8b7] bg-[#faf4ec] px-4 py-5 text-sm leading-6 text-[#6a5948]">
                    No answers yet for this document. Upload a policy and start with one of the
                    starter prompts.
                  </div>
                ) : (
                  visibleAnswers.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[28px] border border-[#e3d5c8] bg-[#faf4ec] px-5 py-5"
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6949]">
                        Question
                      </div>
                      <div className="mt-2 text-sm font-medium leading-6 text-[#1f1a14]">
                        {item.question}
                      </div>
                      <div className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6949]">
                        Answer
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#2a221a]">
                        {item.answer}
                      </div>
                      {item.citations.length > 0 && (
                        <div className="mt-5 flex flex-wrap gap-2">
                          {item.citations.map((citation, index) => (
                            <div
                              key={`${item.id}:${index}`}
                              className="rounded-full border border-[#d8c8b7] bg-white px-3 py-1 text-xs text-[#5b4d40]"
                            >
                              {citation.document ?? selectedDoc?.filename ?? 'Document'}
                              {citation.page ? ` · page ${citation.page}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
