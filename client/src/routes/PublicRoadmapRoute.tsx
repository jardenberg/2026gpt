import { useState } from 'react';
import { buildLoginRedirectUrl, request } from 'librechat-data-provider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import PublicLayout from './PublicLayout';

type RoadmapComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

type RoadmapItem = {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  status: string;
  kind: string;
  priority: string;
  source: string;
  targetWindow: string | null;
  displayOrder: number;
  tags: string[];
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  voteCount: number;
  viewerHasVoted: boolean;
  commentCount: number;
  comments: RoadmapComment[];
};

type RoadmapResponse = {
  viewer: {
    isAuthenticated: boolean;
    isAdmin: boolean;
    name: string | null;
  };
  items: RoadmapItem[];
};

const buildAuthHeaders = (token?: string | null) => ({
  Accept: 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function fetchRoadmap(token?: string | null): Promise<RoadmapResponse> {
  const response = await fetch('/api/public/roadmap', {
    credentials: 'include',
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error('Failed to load public roadmap');
  }

  return response.json();
}

async function mutateJson(url: string, method: string, token?: string | null, body?: unknown) {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

const statusTitles: Record<string, string> = {
  'in-progress': 'In progress',
  next: 'Next up',
  later: 'Later',
  'under-consideration': 'Under consideration',
  shipped: 'Shipped',
};

const kindTitles: Record<string, string> = {
  workflow: 'Workflow',
  platform: 'Platform',
  feature: 'Feature',
  bug: 'Bug',
};

function statusAccent(status: string) {
  if (status === 'in-progress') {
    return 'border-[#c88343] bg-[#fff2e4] text-[#8c5420]';
  }
  if (status === 'next') {
    return 'border-[#2f4f4f]/20 bg-[#e6f0ed] text-[#2f4f4f]';
  }
  if (status === 'shipped') {
    return 'border-[#205336]/20 bg-[#e4f1e8] text-[#205336]';
  }
  return 'border-black/10 bg-[#f4ede4] text-[#6c5743]';
}

export default function PublicRoadmapRoute() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const authBootstrapQuery = useQuery({
    queryKey: ['public-roadmap-auth'],
    queryFn: async () => {
      try {
        const response = await request.refreshToken();
        return response?.token ?? null;
      } catch (_error) {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const authToken = authBootstrapQuery.data ?? null;
  const roadmapQuery = useQuery({
    queryKey: ['public-roadmap', authToken],
    queryFn: () => fetchRoadmap(authToken),
    staleTime: 30_000,
    enabled: !authBootstrapQuery.isLoading,
  });

  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');
  const [ideaKind, setIdeaKind] = useState('feature');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const voteMutation = useMutation({
    mutationFn: async ({ itemId, hasVoted }: { itemId: string; hasVoted: boolean }) =>
      mutateJson(`/api/public/roadmap/${itemId}/vote`, hasVoted ? 'DELETE' : 'POST', authToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-roadmap'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ itemId, body }: { itemId: string; body: string }) =>
      mutateJson(`/api/public/roadmap/${itemId}/comments`, 'POST', authToken, { body }),
    onSuccess: (_data, vars) => {
      setCommentDrafts((current) => ({ ...current, [vars.itemId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['public-roadmap'] });
    },
  });

  const ideaMutation = useMutation({
    mutationFn: async () =>
      mutateJson('/api/public/roadmap', 'POST', authToken, {
        title: ideaTitle,
        description: ideaDescription,
        kind: ideaKind,
      }),
    onSuccess: () => {
      setIdeaTitle('');
      setIdeaDescription('');
      setIdeaKind('feature');
      queryClient.invalidateQueries({ queryKey: ['public-roadmap'] });
    },
  });

  const groupedItems = ['in-progress', 'next', 'later', 'under-consideration', 'shipped'].map(
    (status) => ({
      status,
      title: statusTitles[status],
      items: (roadmapQuery.data?.items ?? []).filter((item) => item.status === status),
    }),
  );

  const viewer = roadmapQuery.data?.viewer;
  const loginHref = buildLoginRedirectUrl(location.pathname, location.search, location.hash);
  const redirectToLogin = () => window.location.assign(loginHref);

  return (
    <PublicLayout
      pageTitle="2026GPT Roadmap"
      eyebrow="Public roadmap"
      title="What we are building, what we are debating, and what users want next."
      description="The board is public. Priorities are visible. Community requests belong next to team priorities, not in a hidden backlog."
      lastUpdated={roadmapQuery.data?.items?.[0]?.updatedAt ?? null}
    >
      {authBootstrapQuery.isLoading || roadmapQuery.isLoading ? (
        <div className="rounded-[32px] border border-black/10 bg-white/80 p-8 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
          Loading roadmap...
        </div>
      ) : roadmapQuery.isError || !roadmapQuery.data ? (
        <div className="rounded-[32px] border border-[#d6b6b6] bg-[#fff7f7] p-8 text-[#7a3030] shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
          Public roadmap data is temporarily unavailable.
        </div>
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                Participate
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Vote, comment, submit</h2>
              <p className="mt-3 text-sm leading-6 text-[#655447]">
                Public reading is open to everyone. Voting, commenting, and idea submission use your
                existing 2026GPT account so the board stays usable and non-anonymous.
              </p>

              {viewer?.isAuthenticated ? (
                <div className="mt-5 rounded-[24px] bg-[#f6f0e8] p-4 text-sm text-[#3c3025]">
                  Signed in as <span className="font-semibold">{viewer.name}</span>.
                </div>
              ) : (
                <a
                  href={loginHref}
                  className="mt-5 inline-flex rounded-full bg-[#17130e] px-4 py-2 text-sm font-medium text-[#f5efe6] transition hover:bg-[#2b2218]"
                >
                  Sign in to participate
                </a>
              )}
            </div>

            <div className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                Submit an idea
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Push the roadmap from the outside</h2>

              {viewer?.isAuthenticated ? (
                <form
                  className="mt-5 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    ideaMutation.mutate();
                  }}
                >
                  <input
                    value={ideaTitle}
                    onChange={(event) => setIdeaTitle(event.target.value)}
                    placeholder="Title"
                    className="w-full rounded-[18px] border border-black/10 bg-[#f6f0e8] px-4 py-3 text-sm outline-none ring-0 transition focus:border-[#b86c2c]"
                  />
                  <textarea
                    value={ideaDescription}
                    onChange={(event) => setIdeaDescription(event.target.value)}
                    placeholder="What should 2026GPT do, and why?"
                    rows={4}
                    className="w-full rounded-[18px] border border-black/10 bg-[#f6f0e8] px-4 py-3 text-sm outline-none ring-0 transition focus:border-[#b86c2c]"
                  />
                  <select
                    value={ideaKind}
                    onChange={(event) => setIdeaKind(event.target.value)}
                    className="w-full rounded-[18px] border border-black/10 bg-[#f6f0e8] px-4 py-3 text-sm outline-none ring-0 transition focus:border-[#b86c2c]"
                  >
                    <option value="feature">Feature</option>
                    <option value="workflow">Workflow</option>
                    <option value="platform">Platform</option>
                    <option value="bug">Bug</option>
                  </select>
                  <button
                    type="submit"
                    disabled={ideaMutation.isPending || !ideaTitle.trim() || !ideaDescription.trim()}
                    className="inline-flex rounded-full bg-[#b86c2c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#9f5b23] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {ideaMutation.isPending ? 'Submitting...' : 'Submit to roadmap'}
                  </button>
                  {ideaMutation.error ? (
                    <p className="text-sm text-[#7a3030]">{(ideaMutation.error as Error).message}</p>
                  ) : null}
                </form>
              ) : (
                <div className="mt-5 rounded-[24px] bg-[#f6f0e8] p-4 text-sm leading-6 text-[#655447]">
                  Sign in, then submit an idea directly from this page. New submissions land in
                  <span className="font-semibold"> Under consideration</span>.
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-5">
            {groupedItems.map((group) => (
              <div
                key={group.status}
                className="rounded-[32px] border border-black/10 bg-white/80 p-5 shadow-[0_24px_80px_rgba(24,18,8,0.08)]"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                  {group.title}
                </div>
                <div className="mt-1 text-sm text-[#655447]">{group.items.length} items</div>

                <div className="mt-5 space-y-4">
                  {group.items.length === 0 ? (
                    <div className="rounded-[24px] bg-[#f6f0e8] p-4 text-sm text-[#655447]">
                      Nothing here yet.
                    </div>
                  ) : (
                    group.items.map((item) => (
                      <article key={item.id} className="rounded-[24px] bg-[#f6f0e8] p-4">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusAccent(item.status)}`}
                          >
                            {statusTitles[item.status]}
                          </span>
                          <span className="rounded-full border border-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6c5743]">
                            {kindTitles[item.kind]}
                          </span>
                          {item.source === 'community' ? (
                            <span className="rounded-full border border-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6c5743]">
                              Community
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-3 text-lg font-semibold leading-6">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[#655447]">{item.description}</p>

                        {item.targetWindow ? (
                          <div className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#8b6949]">
                            Target: {item.targetWindow}
                          </div>
                        ) : null}

                        {item.tags.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-white px-3 py-1 text-xs text-[#655447]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (!viewer?.isAuthenticated) {
                                redirectToLogin();
                                return;
                              }
                              voteMutation.mutate({
                                itemId: item.id,
                                hasVoted: item.viewerHasVoted,
                              });
                            }}
                            disabled={voteMutation.isPending}
                            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                              item.viewerHasVoted
                                ? 'bg-[#17130e] text-[#f5efe6]'
                                : 'bg-white text-[#3c3025] hover:bg-[#ede4d8]'
                            }`}
                          >
                            {item.viewerHasVoted ? 'Voted' : 'Vote'} ({item.voteCount})
                          </button>
                          <div className="text-sm text-[#655447]">{item.commentCount} comments</div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {item.comments.slice(0, 3).map((comment) => (
                            <div key={comment.id} className="rounded-[18px] bg-white px-3 py-3">
                              <div className="text-sm font-semibold">{comment.authorName}</div>
                              <div className="mt-1 text-sm leading-6 text-[#655447]">
                                {comment.body}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4">
                          {viewer?.isAuthenticated ? (
                            <form
                              onSubmit={(event) => {
                                event.preventDefault();
                                const body = commentDrafts[item.id]?.trim();
                                if (!body) {
                                  return;
                                }
                                commentMutation.mutate({ itemId: item.id, body });
                              }}
                            >
                              <textarea
                                value={commentDrafts[item.id] ?? ''}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [item.id]: event.target.value,
                                  }))
                                }
                                rows={3}
                                placeholder="Add a comment"
                                className="w-full rounded-[18px] border border-black/10 bg-white px-3 py-3 text-sm outline-none transition focus:border-[#b86c2c]"
                              />
                              <button
                                type="submit"
                                disabled={commentMutation.isPending || !(commentDrafts[item.id] ?? '').trim()}
                                className="mt-3 inline-flex rounded-full bg-[#b86c2c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#9f5b23] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Comment
                              </button>
                            </form>
                          ) : (
                            <a
                              href={loginHref}
                              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#3c3025] transition hover:bg-[#ede4d8]"
                            >
                              Sign in to comment
                            </a>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </PublicLayout>
  );
}
