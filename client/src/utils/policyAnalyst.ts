export type PolicyAnalystOutlineNode = {
  nodeId: string;
  title: string;
  pageIndex: number | null;
  children: PolicyAnalystOutlineNode[];
};

export type PolicyAnalystDocument = {
  docId: string;
  filename: string;
  title: string | null;
  status: string;
  retrievalReady: boolean;
  outline: PolicyAnalystOutlineNode[];
};

export type PolicyAnalystCitation = {
  document?: string;
  page?: number;
};

export type PolicyAnalystAnswer = {
  id: string;
  docId: string;
  question: string;
  answer: string;
  citations: PolicyAnalystCitation[];
  createdAt: string;
};

const DOCS_STORAGE_KEY = 'policy-analyst:docs';
const ANSWERS_STORAGE_KEY = 'policy-analyst:answers';

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (_error) {
    return fallback;
  }
}

export function readStoredPolicyAnalystDocs(): PolicyAnalystDocument[] {
  if (typeof window === 'undefined') {
    return [];
  }

  return safeParse<PolicyAnalystDocument[]>(window.localStorage.getItem(DOCS_STORAGE_KEY), []);
}

export function writeStoredPolicyAnalystDocs(docs: PolicyAnalystDocument[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(docs));
}

export function readStoredPolicyAnalystAnswers(): PolicyAnalystAnswer[] {
  if (typeof window === 'undefined') {
    return [];
  }

  return safeParse<PolicyAnalystAnswer[]>(window.localStorage.getItem(ANSWERS_STORAGE_KEY), []);
}

export function writeStoredPolicyAnalystAnswers(answers: PolicyAnalystAnswer[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(answers));
}

export async function fetchPolicyAnalystConfig() {
  const response = await fetch('/api/policy-analyst/config', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to load Policy Analyst configuration');
  }

  return response.json() as Promise<{ enabled: boolean }>;
}

export async function uploadPolicyAnalystDocument(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/policy-analyst/documents', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await response.json().catch(() => ({ message: 'Upload failed' }));

  if (!response.ok) {
    throw new Error(data.message || 'Upload failed');
  }

  return data as PolicyAnalystDocument;
}

export async function fetchPolicyAnalystDocument(docId: string) {
  const response = await fetch(`/api/policy-analyst/documents/${encodeURIComponent(docId)}`, {
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({ message: 'Document lookup failed' }));

  if (!response.ok) {
    throw new Error(data.message || 'Document lookup failed');
  }

  return data as Omit<PolicyAnalystDocument, 'filename'> & { docId: string };
}

export async function queryPolicyAnalystDocument(docId: string, question: string) {
  const response = await fetch('/api/policy-analyst/query', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ docId, question }),
  });

  const data = await response.json().catch(() => ({ message: 'Query failed' }));

  if (!response.ok) {
    throw new Error(data.message || 'Query failed');
  }

  return data as {
    answer: string;
    citations: PolicyAnalystCitation[];
    usage: { total_tokens?: number } | null;
    completionId: string | null;
  };
}
