import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import PublicLayout from './PublicLayout';

type DashboardResponse = {
  updatedAt: string;
  summary: {
    users: number | null;
    conversations: number | null;
    messages: number | null;
    activeUsers7d: number | null;
    activeUsers30d: number | null;
    newUsers30d: number | null;
    newConversations30d: number | null;
    newMessages30d: number | null;
  };
  llm: {
    status: 'live' | 'pending' | 'unavailable' | 'unconfigured';
    note: string;
    spend30d: number | null;
    spend7d: number | null;
    tokenTotal30d: number | null;
    requestTotal30d: number | null;
    modelMix: Array<{
      model: string;
      spend: number;
      requests: number;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
    }>;
    daily: Array<{
      date: string;
      spend: number;
      requests: number;
      tokens: number;
    }>;
  };
  search: {
    status: 'live' | 'estimated' | 'pending' | 'unavailable' | 'unconfigured';
    note: string;
    searches30d: number | null;
    processedPages30d: number | null;
    serperSpend30d: number | null;
    jinaEstimatedTokens30d: number | null;
    jinaEstimatedSpend30d: number | null;
    firecrawlEstimatedSpend30d: number | null;
    totalEstimatedSpend30d: number | null;
    firecrawl: {
      status: 'live' | 'estimated' | 'pending' | 'unavailable' | 'unconfigured';
      note: string;
      billingPeriod: {
        start: string | null;
        end: string | null;
        remainingCredits: number | null;
        planCredits: number | null;
      } | null;
      historical: {
        creditsUsed: number | null;
        spendUsd: number | null;
      } | null;
    };
  };
  infra: {
    status: 'live' | 'pending' | 'unavailable' | 'unconfigured';
    note: string;
    projectName: string | null;
    workspaceName: string | null;
    plan: string | null;
    billingPeriod: {
      start: string;
      end: string;
      elapsedDays: number;
      totalDays: number;
    } | null;
    currentUsageUsd: number | null;
    projectedUsageUsd: number | null;
    currentBillUsd: number | null;
    planFeeUsd: number | null;
    includedUsageUsd: number | null;
    creditBalanceUsd: number | null;
    remainingUsageCreditBalanceUsd: number | null;
    appliedCreditsUsd: number | null;
    currentBreakdown: Array<{
      measurement: string;
      name: string;
      usageValue: number;
      usageUnit: string;
      costUsd: number;
      rateLabel: string;
    }>;
    projectedBreakdown: Array<{
      measurement: string;
      name: string;
      usageValue: number;
      usageUnit: string;
      costUsd: number;
      rateLabel: string;
    }>;
  };
  health: Array<{
    name: string;
    url: string;
    status: string;
    code: number | null;
    latencyMs: number | null;
  }>;
  costCoverage: Array<{
    name: string;
    status: string;
    note: string;
  }>;
  methodology: string[];
};

async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await fetch('/api/public/dashboard', {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load public dashboard');
  }

  return response.json();
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const detailedNumber = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

function metricValue(value: number | null, formatter?: (value: number) => string) {
  if (value == null) {
    return 'Pending';
  }

  return formatter ? formatter(value) : compactNumber.format(value);
}

function statusPill(status: string) {
  if (status === 'live' || status === 'healthy') {
    return 'bg-[#dcefe3] text-[#205336]';
  }
  if (status === 'degraded' || status === 'pending') {
    return 'bg-[#f9ecd8] text-[#8a5f1d]';
  }
  return 'bg-[#f5dada] text-[#8b2b2b]';
}

function formatDateRange(date: string | null | undefined) {
  if (!date) {
    return 'Pending';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export default function PublicDashboardRoute() {
  const dashboardQuery = useQuery({
    queryKey: ['public-dashboard'],
    queryFn: fetchDashboard,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const dashboard = dashboardQuery.data;
  const maxSpend = Math.max(...(dashboard?.llm.daily ?? []).map((entry) => entry.spend), 1);

  return (
    <PublicLayout
      pageTitle="2026GPT Dash"
      eyebrow="Public dashboard"
      title="A public read on what 2026GPT is doing."
      description="Usage, cost coverage, model mix, and operational health in one place. Public by default, explicit about what is tracked, and honest about what still is not."
      lastUpdated={dashboard?.updatedAt}
    >
      {dashboardQuery.isLoading ? (
        <div className="rounded-[32px] border border-black/10 bg-white/80 p-8 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
          Loading live dashboard data...
        </div>
      ) : dashboardQuery.isError || !dashboard ? (
        <div className="rounded-[32px] border border-[#d6b6b6] bg-[#fff7f7] p-8 text-[#7a3030] shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
          Public dashboard data is temporarily unavailable.
        </div>
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                label: 'Tracked LLM spend (30d)',
                value: metricValue(dashboard.llm.spend30d, (value) => currency.format(value)),
                detail: dashboard.llm.status === 'live' ? 'Live from LiteLLM' : 'Instrumentation pending',
              },
              {
                label: 'Tracked external spend (30d)',
                value: metricValue(dashboard.search.totalEstimatedSpend30d, (value) =>
                  currency.format(value),
                ),
                detail:
                  dashboard.search.status === 'estimated'
                    ? 'Search, crawl, and rerank estimate'
                    : 'Instrumentation pending',
              },
              {
                label: 'Railway infra usage (period)',
                value: metricValue(dashboard.infra.currentUsageUsd, (value) => currency.format(value)),
                detail:
                  dashboard.infra.status === 'live'
                    ? 'Live current-period infrastructure usage'
                    : 'Instrumentation pending',
              },
              {
                label: 'Projected infra usage',
                value: metricValue(dashboard.infra.projectedUsageUsd, (value) =>
                  currency.format(value),
                ),
                detail:
                  dashboard.infra.status === 'live'
                    ? 'Projected month-end infrastructure usage'
                    : 'Projection pending',
              },
              {
                label: 'Requests through gateway (30d)',
                value: metricValue(dashboard.llm.requestTotal30d),
                detail: 'Successful and failed API requests',
              },
              {
                label: 'Search workflows (30d)',
                value: metricValue(dashboard.search.searches30d),
                detail: 'Stored web-search runs',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-[28px] border border-black/10 bg-white/80 p-5 shadow-[0_24px_80px_rgba(24,18,8,0.08)]"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                  {card.label}
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight">{card.value}</div>
                <p className="mt-2 text-sm leading-6 text-[#655447]">{card.detail}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                Search and crawl
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">External tool spend coverage</h2>
              <p className="mt-2 text-sm leading-6 text-[#655447]">{dashboard.search.note}</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ['Search runs (30d)', metricValue(dashboard.search.searches30d)],
                  ['Pages processed (30d)', metricValue(dashboard.search.processedPages30d)],
                  [
                    'Estimated Serper spend',
                    metricValue(dashboard.search.serperSpend30d, (value) => currency.format(value)),
                  ],
                  [
                    'Estimated Firecrawl spend',
                    metricValue(dashboard.search.firecrawlEstimatedSpend30d, (value) =>
                      currency.format(value),
                    ),
                  ],
                  [
                    'Estimated Jina spend',
                    metricValue(dashboard.search.jinaEstimatedSpend30d, (value) =>
                      currency.format(value),
                    ),
                  ],
                  [
                    'Estimated Jina tokens',
                    metricValue(dashboard.search.jinaEstimatedTokens30d),
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[24px] bg-[#f6f0e8] p-4">
                    <div className="text-xs font-medium uppercase tracking-[0.22em] text-[#8b6949]">
                      {label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                Firecrawl
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Live billing-period credits</h2>
              <p className="mt-2 text-sm leading-6 text-[#655447]">{dashboard.search.firecrawl.note}</p>

              <div className="mt-6 space-y-3">
                {[
                  [
                    'Credits used',
                    metricValue(dashboard.search.firecrawl.historical?.creditsUsed ?? null),
                  ],
                  [
                    'Current-period spend',
                    metricValue(dashboard.search.firecrawl.historical?.spendUsd ?? null, (value) =>
                      currency.format(value),
                    ),
                  ],
                  [
                    'Credits remaining',
                    metricValue(dashboard.search.firecrawl.billingPeriod?.remainingCredits ?? null),
                  ],
                  [
                    'Plan credits',
                    metricValue(dashboard.search.firecrawl.billingPeriod?.planCredits ?? null),
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-[24px] bg-[#f6f0e8] px-4 py-3"
                  >
                    <div className="text-sm font-medium uppercase tracking-[0.18em] text-[#8b6949]">
                      {label}
                    </div>
                    <div className="text-lg font-semibold">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                Railway infrastructure
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Live hosting cost context</h2>
              <p className="mt-2 text-sm leading-6 text-[#655447]">{dashboard.infra.note}</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  [
                    'Current usage',
                    metricValue(dashboard.infra.currentUsageUsd, (value) => currency.format(value)),
                  ],
                  [
                    'Projected usage',
                    metricValue(dashboard.infra.projectedUsageUsd, (value) =>
                      currency.format(value),
                    ),
                  ],
                  [
                    'Current bill',
                    metricValue(dashboard.infra.currentBillUsd, (value) => currency.format(value)),
                  ],
                  [
                    'Plan fee',
                    metricValue(dashboard.infra.planFeeUsd, (value) => currency.format(value)),
                  ],
                  [
                    'Included usage left',
                    metricValue(dashboard.infra.remainingUsageCreditBalanceUsd, (value) =>
                      currency.format(value),
                    ),
                  ],
                  [
                    'Credit balance',
                    metricValue(dashboard.infra.creditBalanceUsd, (value) => currency.format(value)),
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[24px] bg-[#f6f0e8] p-4">
                    <div className="text-xs font-medium uppercase tracking-[0.22em] text-[#8b6949]">
                      {label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[24px] bg-[#f6f0e8] p-4 text-sm leading-6 text-[#655447]">
                <div className="font-semibold text-[#2b2218]">
                  {dashboard.infra.projectName ?? 'Current project'}
                </div>
                <div>
                  {dashboard.infra.plan ?? 'Plan pending'} plan on{' '}
                  {dashboard.infra.workspaceName ?? 'workspace pending'}
                </div>
                <div className="mt-2">
                  Billing period:{' '}
                  {dashboard.infra.billingPeriod
                    ? `${formatDateRange(dashboard.infra.billingPeriod.start)} to ${formatDateRange(dashboard.infra.billingPeriod.end)}`
                    : 'Pending'}
                </div>
                <div>
                  Elapsed: {metricValue(dashboard.infra.billingPeriod?.elapsedDays ?? null, (value) =>
                    `${detailedNumber.format(value)} days`,
                  )}{' '}
                  /{' '}
                  {metricValue(dashboard.infra.billingPeriod?.totalDays ?? null, (value) =>
                    `${detailedNumber.format(value)} days`,
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                Infra breakdown
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">What hosting cost is made of</h2>
              <div className="mt-6 space-y-3">
                {dashboard.infra.currentBreakdown.length === 0 ? (
                  <div className="rounded-[24px] bg-[#f6f0e8] p-4 text-sm text-[#655447]">
                    Railway infrastructure breakdown will appear here when live billing is available.
                  </div>
                ) : (
                  dashboard.infra.currentBreakdown.map((item) => {
                    const projected = dashboard.infra.projectedBreakdown.find(
                      (candidate) => candidate.measurement === item.measurement,
                    );

                    return (
                      <div key={item.measurement} className="rounded-[24px] bg-[#f6f0e8] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-lg font-semibold">{item.name}</div>
                          <div className="text-lg font-semibold">
                            {currency.format(item.costUsd)}
                          </div>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[#655447]">
                          Current: {detailedNumber.format(item.usageValue)} {item.usageUnit}
                        </div>
                        <div className="text-sm leading-6 text-[#655447]">
                          Projected: {projected ? currency.format(projected.costUsd) : 'Pending'}
                        </div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[#8b6949]">
                          {item.rateLabel}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                    Product usage
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Real product activity</h2>
                </div>
                <Link
                  to="/roadmap"
                  className="inline-flex rounded-full bg-[#17130e] px-4 py-2 text-sm font-medium text-[#f5efe6] transition hover:bg-[#2b2218]"
                >
                  View public roadmap
                </Link>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ['Users', metricValue(dashboard.summary.users)],
                  ['Conversations', metricValue(dashboard.summary.conversations)],
                  ['Messages', metricValue(dashboard.summary.messages)],
                  ['Active users (7d)', metricValue(dashboard.summary.activeUsers7d)],
                  ['Active users (30d)', metricValue(dashboard.summary.activeUsers30d)],
                  ['New conversations (30d)', metricValue(dashboard.summary.newConversations30d)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[24px] bg-[#f6f0e8] p-4">
                    <div className="text-xs font-medium uppercase tracking-[0.22em] text-[#8b6949]">
                      {label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                Operational health
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Production and staging status</h2>

              <div className="mt-6 space-y-3">
                {dashboard.health.map((service) => (
                  <div
                    key={service.name}
                    className="flex flex-col gap-3 rounded-[24px] bg-[#f6f0e8] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-lg font-semibold">{service.name}</div>
                      <div className="text-sm text-[#655447]">{service.url}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusPill(service.status)}`}>
                        {service.status}
                      </span>
                      <div className="text-sm text-[#655447]">
                        {service.code ?? 'n/a'} / {service.latencyMs ?? 'n/a'} ms
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                Model mix
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Where the LLM spend goes</h2>
              <p className="mt-2 text-sm leading-6 text-[#655447]">{dashboard.llm.note}</p>

              <div className="mt-6 space-y-4">
                {dashboard.llm.modelMix.length === 0 ? (
                  <div className="rounded-[24px] bg-[#f6f0e8] p-4 text-sm text-[#655447]">
                    Model mix will appear here when live analytics are available.
                  </div>
                ) : (
                  dashboard.llm.modelMix.slice(0, 6).map((model) => {
                    const percentage =
                      dashboard.llm.spend30d && dashboard.llm.spend30d > 0
                        ? Math.max((model.spend / dashboard.llm.spend30d) * 100, 4)
                        : 0;

                    return (
                      <div key={model.model} className="rounded-[24px] bg-[#f6f0e8] p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <div className="text-lg font-semibold">{model.model}</div>
                            <div className="text-sm text-[#655447]">
                              {compactNumber.format(model.requests)} requests /{' '}
                              {compactNumber.format(model.totalTokens)} tokens
                            </div>
                          </div>
                          <div className="text-lg font-semibold">{currency.format(model.spend)}</div>
                        </div>
                        <div className="mt-3 h-3 rounded-full bg-white">
                          <div
                            className="h-3 rounded-full bg-gradient-to-r from-[#b86c2c] to-[#d7b58c]"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                  Cost coverage
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">What is live, what is next</h2>
                <div className="mt-6 space-y-3">
                  {dashboard.costCoverage.map((coverage) => (
                    <div key={coverage.name} className="rounded-[24px] bg-[#f6f0e8] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-semibold">{coverage.name}</div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusPill(coverage.status)}`}>
                          {coverage.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#655447]">{coverage.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
                  Methodology
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Public by intent</h2>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-[#655447]">
                  {dashboard.methodology.map((line) => (
                    <li key={line} className="rounded-[24px] bg-[#f6f0e8] px-4 py-3">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
              Daily LLM spend trend
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">How the last 30 days moved</h2>

            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {dashboard.llm.daily.length === 0 ? (
                <div className="rounded-[24px] bg-[#f6f0e8] p-4 text-sm text-[#655447]">
                  No daily spend data available yet.
                </div>
              ) : (
                dashboard.llm.daily.map((entry) => (
                  <div key={entry.date} className="rounded-[24px] bg-[#f6f0e8] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{entry.date}</div>
                        <div className="text-sm text-[#655447]">
                          {compactNumber.format(entry.requests)} requests /{' '}
                          {compactNumber.format(entry.tokens)} tokens
                        </div>
                      </div>
                      <div className="text-base font-semibold">{currency.format(entry.spend)}</div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-[#2f4f4f] to-[#93b0a1]"
                        style={{ width: `${Math.max((entry.spend / maxSpend) * 100, 3)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </PublicLayout>
  );
}
