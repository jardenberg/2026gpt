const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');

const PRODUCTION_URL =
  process.env.PUBLIC_DASHBOARD_PRODUCTION_URL || 'https://2026gpt.jardenberg.se';
const STAGING_URL = process.env.PUBLIC_DASHBOARD_STAGING_URL || 'https://stage2026gpt.jardenberg.se';
const SEARCH_LOOKBACK_DAYS = Number(process.env.PUBLIC_DASHBOARD_SEARCH_LOOKBACK_DAYS || 30);
const SERPER_COST_PER_SEARCH_USD = Number(
  process.env.PUBLIC_DASHBOARD_SERPER_COST_PER_SEARCH_USD || 0.001,
);
const JINA_COST_PER_MILLION_TOKENS_USD = Number(
  process.env.PUBLIC_DASHBOARD_JINA_COST_PER_MILLION_TOKENS_USD || 0.02,
);
const FIRECRAWL_PLAN_USD_BY_CREDITS = {
  3000: 16,
  100000: 83,
  500000: 333,
  1000000: 599,
};
const RAILWAY_GRAPHQL_URL =
  process.env.PUBLIC_DASHBOARD_RAILWAY_GRAPHQL_URL || 'https://backboard.railway.app/graphql/v2';
const RAILWAY_MONTH_MINUTES = 30 * 24 * 60;
const RAILWAY_BILLABLE_MEASUREMENTS = [
  'MEMORY_USAGE_GB',
  'CPU_USAGE',
  'NETWORK_TX_GB',
  'DISK_USAGE_GB',
];
const RAILWAY_MEASUREMENT_DETAILS = {
  MEMORY_USAGE_GB: {
    name: 'Memory',
    usageUnit: 'GB-minute',
    pricePerUnitUsd: 10 / RAILWAY_MONTH_MINUTES,
    rateLabel: '$0.000231 / GB / minute',
  },
  CPU_USAGE: {
    name: 'CPU',
    usageUnit: 'vCPU-minute',
    pricePerUnitUsd: 20 / RAILWAY_MONTH_MINUTES,
    rateLabel: '$0.000463 / vCPU / minute',
  },
  NETWORK_TX_GB: {
    name: 'Egress',
    usageUnit: 'GB',
    pricePerUnitUsd: 0.05,
    rateLabel: '$0.05 / GB',
  },
  DISK_USAGE_GB: {
    name: 'Volume',
    usageUnit: 'GB-minute',
    pricePerUnitUsd: 0.15 / RAILWAY_MONTH_MINUTES,
    rateLabel: '$0.000003 / GB / minute',
  },
};

const formatDate = (date) => date.toISOString().slice(0, 10);

const daysAgo = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundWhole = (value) => Math.round(value + Number.EPSILON);

function estimateTokensFromText(text) {
  const normalized = typeof text === 'string' ? text.trim() : '';
  if (!normalized) {
    return 0;
  }

  return Math.max(Math.ceil(normalized.length / 4), 1);
}

function getFirecrawlCostPerCredit(planCredits) {
  const explicitCostPerCredit = Number(process.env.PUBLIC_DASHBOARD_FIRECRAWL_COST_PER_CREDIT_USD);
  if (Number.isFinite(explicitCostPerCredit) && explicitCostPerCredit > 0) {
    return explicitCostPerCredit;
  }

  const explicitPlanCost = Number(process.env.PUBLIC_DASHBOARD_FIRECRAWL_MONTHLY_PLAN_USD);
  if (Number.isFinite(explicitPlanCost) && explicitPlanCost > 0 && Number(planCredits) > 0) {
    return explicitPlanCost / Number(planCredits);
  }

  const knownPlanCost = FIRECRAWL_PLAN_USD_BY_CREDITS[Number(planCredits)];
  if (knownPlanCost != null && Number(planCredits) > 0) {
    return knownPlanCost / Number(planCredits);
  }

  return null;
}

function sumMetric(results, key, predicate = () => true) {
  return results.reduce((total, result) => {
    if (!predicate(result)) {
      return total;
    }
    return total + Number(result.metrics?.[key] ?? 0);
  }, 0);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

async function fetchRailwayGraphQL(query, variables = {}) {
  const token =
    process.env.PUBLIC_DASHBOARD_RAILWAY_API_TOKEN ||
    process.env.RAILWAY_API_TOKEN ||
    process.env.RAILWAY_ALL_ACCESS_TOKEN;

  if (!token) {
    throw new Error('Railway API token is not configured.');
  }

  const response = await fetch(RAILWAY_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': '2026GPT Dashboard/1.0',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`Railway GraphQL request failed (${response.status}).`);
  }

  const payload = await response.json();
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const message = payload.errors.map((error) => error.message).join('; ');
    throw new Error(message || 'Railway GraphQL returned errors.');
  }

  return payload.data;
}

function summarizeRailwayUsage(results, valueKey, normalizedTotalUsd = null) {
  const items = RAILWAY_BILLABLE_MEASUREMENTS.map((measurement) => {
    const definition = RAILWAY_MEASUREMENT_DETAILS[measurement];
    const value = Number(
      results.find((result) => result.measurement === measurement)?.[valueKey] ?? 0,
    );
    const rawCostUsd = value * definition.pricePerUnitUsd;

    return {
      measurement,
      name: definition.name,
      usageValue: round(value),
      usageUnit: definition.usageUnit,
      rateLabel: definition.rateLabel,
      rawCostUsd,
      costUsd: round(rawCostUsd),
    };
  });

  const rawTotalUsd = items.reduce((total, item) => total + item.rawCostUsd, 0);
  const normalizedItems =
    normalizedTotalUsd != null && rawTotalUsd > 0
      ? items.map((item) => ({
          ...item,
          costUsd: round((item.rawCostUsd / rawTotalUsd) * normalizedTotalUsd),
        }))
      : items;

  const normalizedTotal =
    normalizedTotalUsd != null
      ? round(
          normalizedItems.reduce((total, item) => total + Number(item.costUsd ?? 0), 0),
        )
      : round(rawTotalUsd);

  return {
    totalUsd: normalizedTotal,
    rawTotalUsd: round(rawTotalUsd),
    items: normalizedItems.map((item) => ({
      measurement: item.measurement,
      name: item.name,
      usageValue: item.usageValue,
      usageUnit: item.usageUnit,
      costUsd: item.costUsd,
      rateLabel: item.rateLabel,
    })),
  };
}

function getRailwayProjectId() {
  return process.env.PUBLIC_DASHBOARD_RAILWAY_PROJECT_ID || process.env.RAILWAY_PROJECT_ID || null;
}

function getCurrentRailwaySubscription(subscriptions = []) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return null;
  }

  return subscriptions.find((subscription) => subscription?.status === 'active') || subscriptions[0];
}

function getRailwayPlanFee(subscription) {
  if (!subscription || !Array.isArray(subscription.items)) {
    return null;
  }

  const total = subscription.items.reduce((sum, item) => {
    const quantity = item?.quantity == null ? null : Number(item.quantity);
    const priceDollars = Number(item?.priceDollars ?? 0);
    if (quantity == null || !Number.isFinite(priceDollars)) {
      return sum;
    }
    return sum + priceDollars * quantity;
  }, 0);

  return Number.isFinite(total) ? round(total) : null;
}

async function getRailwayInfraMetrics() {
  const projectId = getRailwayProjectId();
  const tokenConfigured =
    process.env.PUBLIC_DASHBOARD_RAILWAY_API_TOKEN ||
    process.env.RAILWAY_API_TOKEN ||
    process.env.RAILWAY_ALL_ACCESS_TOKEN;

  if (!tokenConfigured || !projectId) {
    return {
      status: 'unconfigured',
      note: 'Railway billing credentials are not configured on this service.',
      projectName: null,
      workspaceName: null,
      plan: null,
      billingPeriod: null,
      currentUsageUsd: null,
      projectedUsageUsd: null,
      currentBillUsd: null,
      planFeeUsd: null,
      includedUsageUsd: null,
      creditBalanceUsd: null,
      remainingUsageCreditBalanceUsd: null,
      appliedCreditsUsd: null,
      currentBreakdown: [],
      projectedBreakdown: [],
    };
  }

  try {
    const metadata = await fetchRailwayGraphQL(
      `
        query PublicDashboardRailwayMetadata($projectId: String!) {
          project(id: $projectId) {
            id
            name
            workspace {
              id
              name
              plan
              customer {
                currentUsage
                appliedCredits
                creditBalance
                remainingUsageCreditBalance
                billingPeriod {
                  start
                  end
                }
                subscriptions {
                  id
                  status
                  nextInvoiceCurrentTotal
                  nextInvoiceDate
                  billingCycleAnchor
                  items {
                    itemId
                    priceDollars
                    quantity
                  }
                }
              }
            }
          }
        }
      `,
      { projectId },
    );

    const project = metadata?.project;
    const workspace = project?.workspace;
    const customer = workspace?.customer;
    const billingPeriod = customer?.billingPeriod;

    if (!project || !workspace || !customer || !billingPeriod?.start || !billingPeriod?.end) {
      return {
        status: 'unavailable',
        note: 'Railway billing metadata is incomplete for this project.',
        projectName: project?.name ?? null,
        workspaceName: workspace?.name ?? null,
        plan: workspace?.plan ?? null,
        billingPeriod: null,
        currentUsageUsd: null,
        projectedUsageUsd: null,
        currentBillUsd: null,
        planFeeUsd: null,
        includedUsageUsd: null,
        creditBalanceUsd: null,
        remainingUsageCreditBalanceUsd: null,
        appliedCreditsUsd: null,
        currentBreakdown: [],
        projectedBreakdown: [],
      };
    }

    const usageData = await fetchRailwayGraphQL(
      `
        query PublicDashboardRailwayUsage(
          $projectId: String!
          $startDate: DateTime!
          $endDate: DateTime!
          $measurements: [MetricMeasurement!]!
        ) {
          usage(
            projectId: $projectId
            startDate: $startDate
            endDate: $endDate
            measurements: $measurements
          ) {
            measurement
            value
          }
          estimatedUsage(projectId: $projectId, measurements: $measurements) {
            measurement
            estimatedValue
            projectId
          }
        }
      `,
      {
        projectId,
        startDate: billingPeriod.start,
        endDate: new Date().toISOString(),
        measurements: RAILWAY_BILLABLE_MEASUREMENTS,
      },
    );

    const currentUsageUsd = round(Number(customer.currentUsage ?? 0));
    const currentBreakdown = summarizeRailwayUsage(
      usageData?.usage ?? [],
      'value',
      currentUsageUsd,
    );
    const projectedBreakdown = summarizeRailwayUsage(
      usageData?.estimatedUsage ?? [],
      'estimatedValue',
    );
    const currentSubscription = getCurrentRailwaySubscription(customer.subscriptions);
    const planFeeUsd = getRailwayPlanFee(currentSubscription);
    const billingStart = new Date(billingPeriod.start);
    const billingEnd = new Date(billingPeriod.end);
    const now = new Date();
    const elapsedMs = Math.max(now.getTime() - billingStart.getTime(), 0);
    const totalMs = Math.max(billingEnd.getTime() - billingStart.getTime(), 0);

    return {
      status: 'live',
      note:
        'Railway current usage, billing-period dates, and invoice context are live from Railway GraphQL. Resource breakdown and month-end projection are derived from Railway usage metrics with Railway public pricing.',
      projectName: project.name,
      workspaceName: workspace.name,
      plan: workspace.plan,
      billingPeriod: {
        start: billingPeriod.start,
        end: billingPeriod.end,
        elapsedDays: round(elapsedMs / (1000 * 60 * 60 * 24)),
        totalDays: round(totalMs / (1000 * 60 * 60 * 24)),
      },
      currentUsageUsd,
      projectedUsageUsd: projectedBreakdown.totalUsd,
      currentBillUsd:
        currentSubscription?.nextInvoiceCurrentTotal != null
          ? round(Number(currentSubscription.nextInvoiceCurrentTotal) / 100)
          : null,
      planFeeUsd,
      includedUsageUsd: planFeeUsd,
      creditBalanceUsd: round(Number(customer.creditBalance ?? 0)),
      remainingUsageCreditBalanceUsd: round(Number(customer.remainingUsageCreditBalance ?? 0)),
      appliedCreditsUsd: round(Number(customer.appliedCredits ?? 0)),
      currentBreakdown: currentBreakdown.items,
      projectedBreakdown: projectedBreakdown.items,
    };
  } catch (error) {
    logger.warn('[publicDashboard] Failed to fetch Railway billing', error);
    return {
      status: 'unavailable',
      note: 'Railway billing request failed.',
      projectName: null,
      workspaceName: null,
      plan: null,
      billingPeriod: null,
      currentUsageUsd: null,
      projectedUsageUsd: null,
      currentBillUsd: null,
      planFeeUsd: null,
      includedUsageUsd: null,
      creditBalanceUsd: null,
      remainingUsageCreditBalanceUsd: null,
      appliedCreditsUsd: null,
      currentBreakdown: [],
      projectedBreakdown: [],
    };
  }
}

function getLiteLLMOrigin() {
  if (process.env.LITELLM_BASE_URL) {
    return new URL('/user/daily/activity/aggregated', process.env.LITELLM_BASE_URL);
  }

  if (process.env.RAILWAY_SERVICE_LITELLM_URL) {
    return new URL('/user/daily/activity/aggregated', `https://${process.env.RAILWAY_SERVICE_LITELLM_URL}`);
  }

  return null;
}

async function getLiteLLMMetrics() {
  const endpoint = getLiteLLMOrigin();
  const key = process.env.LITELLM_MASTER_KEY;
  if (!endpoint || !key) {
    return {
      status: 'unconfigured',
      note: 'LiteLLM credentials are not configured on this service.',
      spend30d: null,
      spend7d: null,
      tokenTotal30d: null,
      requestTotal30d: null,
      modelMix: [],
      daily: [],
    };
  }

  const start30 = formatDate(daysAgo(30));
  const start7 = formatDate(daysAgo(7));
  const end = formatDate(new Date());

  endpoint.searchParams.set('start_date', start30);
  endpoint.searchParams.set('end_date', end);

  try {
    const payload = await fetchJson(endpoint, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });

    const results = Array.isArray(payload.results) ? payload.results : [];
    const sevenDayCutoff = new Date(start7);
    const modelAccumulator = new Map();

    for (const day of results) {
      const models = day.breakdown?.models ?? {};
      for (const [modelName, modelData] of Object.entries(models)) {
        const metrics = modelData?.metrics ?? {};
        const existing = modelAccumulator.get(modelName) ?? {
          model: modelName,
          spend: 0,
          requests: 0,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
        };

        existing.spend += Number(metrics.spend ?? 0);
        existing.requests += Number(metrics.api_requests ?? 0);
        existing.totalTokens += Number(metrics.total_tokens ?? 0);
        existing.promptTokens += Number(metrics.prompt_tokens ?? 0);
        existing.completionTokens += Number(metrics.completion_tokens ?? 0);

        modelAccumulator.set(modelName, existing);
      }
    }

    const modelMix = Array.from(modelAccumulator.values())
      .sort((a, b) => b.spend - a.spend)
      .map((item) => ({
        ...item,
        spend: round(item.spend),
      }));

    return {
      status: 'live',
      note: 'Live LLM spend and token metrics sourced from LiteLLM daily activity analytics.',
      spend30d: round(sumMetric(results, 'spend')),
      spend7d: round(
        sumMetric(results, 'spend', (result) => new Date(result.date) >= sevenDayCutoff),
      ),
      tokenTotal30d: Math.round(sumMetric(results, 'total_tokens')),
      requestTotal30d: Math.round(sumMetric(results, 'api_requests')),
      modelMix,
      daily: results.map((result) => ({
        date: result.date,
        spend: round(Number(result.metrics?.spend ?? 0)),
        requests: Number(result.metrics?.api_requests ?? 0),
        tokens: Number(result.metrics?.total_tokens ?? 0),
      })),
    };
  } catch (error) {
    logger.warn('[publicDashboard] Failed to fetch LiteLLM analytics', error);
    return {
      status: 'unavailable',
      note: 'LiteLLM analytics request failed.',
      spend30d: null,
      spend7d: null,
      tokenTotal30d: null,
      requestTotal30d: null,
      modelMix: [],
      daily: [],
    };
  }
}

async function getFirecrawlUsage() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const baseUrl = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
  if (!apiKey) {
    return {
      status: 'unconfigured',
      note: 'Firecrawl credentials are not configured on this service.',
      billingPeriod: null,
      historical: null,
      costPerCreditUsd: null,
    };
  }

  const creditUrl = new URL('/v2/team/credit-usage', baseUrl);
  const historicalUrl = new URL('/v2/team/credit-usage/historical', baseUrl);

  try {
    const [creditPayload, historicalPayload] = await Promise.all([
      fetchJson(creditUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      }),
      fetchJson(historicalUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      }),
    ]);

    const billingData = creditPayload?.data ?? {};
    const periods = Array.isArray(historicalPayload?.periods) ? historicalPayload.periods : [];
    const currentPeriod = periods[0] ?? null;
    const planCredits = Number(billingData.planCredits ?? 0);
    const remainingCredits = Number(billingData.remainingCredits ?? 0);
    const creditsUsed = Number(currentPeriod?.creditsUsed ?? Math.max(planCredits - remainingCredits, 0));
    const costPerCreditUsd = getFirecrawlCostPerCredit(planCredits);

    return {
      status: 'live',
      note: 'Current Firecrawl billing-period credit usage is sourced live from the Firecrawl team usage API.',
      billingPeriod: {
        start: billingData.billingPeriodStart ?? null,
        end: billingData.billingPeriodEnd ?? null,
        remainingCredits: roundWhole(remainingCredits),
        planCredits: roundWhole(planCredits),
      },
      historical: {
        creditsUsed: roundWhole(creditsUsed),
        spendUsd: costPerCreditUsd != null ? round(creditsUsed * costPerCreditUsd) : null,
      },
      costPerCreditUsd,
    };
  } catch (error) {
    logger.warn('[publicDashboard] Failed to fetch Firecrawl usage', error);
    return {
      status: 'unavailable',
      note: 'Firecrawl usage request failed.',
      billingPeriod: null,
      historical: null,
      costPerCreditUsd: null,
    };
  }
}

function collectSearchAttachmentMetrics(attachment) {
  const data = attachment?.web_search;
  if (!data || typeof data !== 'object') {
    return {
      searches: 0,
      processedPages: 0,
      jinaEstimatedTokens: 0,
    };
  }

  const sources = [
    ...(Array.isArray(data.organic) ? data.organic : []),
    ...(Array.isArray(data.topStories) ? data.topStories : []),
  ];

  let processedPages = 0;
  let jinaEstimatedTokens = 0;

  for (const source of sources) {
    if (source?.processed) {
      processedPages += 1;
    }

    const text = [source?.title, source?.snippet, source?.content].filter(Boolean).join(' ');
    jinaEstimatedTokens += estimateTokensFromText(text);
  }

  return {
    searches: 1,
    processedPages,
    jinaEstimatedTokens,
  };
}

async function getSearchMetrics() {
  const Message = mongoose.models.Message;

  if (!Message) {
    return {
      status: 'unavailable',
      note: 'Search metrics are unavailable because the message model is not loaded.',
      searches30d: null,
      processedPages30d: null,
      serperSpend30d: null,
      jinaEstimatedTokens30d: null,
      jinaEstimatedSpend30d: null,
      firecrawlEstimatedSpend30d: null,
      firecrawl: {
        status: 'unavailable',
        note: 'Firecrawl usage could not be queried.',
        billingPeriod: null,
        historical: null,
      },
      totalEstimatedSpend30d: null,
    };
  }

  const since = daysAgo(SEARCH_LOOKBACK_DAYS);
  const [messages, firecrawl] = await Promise.all([
    Message.find(
      {
        createdAt: { $gte: since },
        attachments: { $elemMatch: { type: 'web_search' } },
      },
      { attachments: 1 },
    ).lean(),
    getFirecrawlUsage(),
  ]);

  let searches30d = 0;
  let processedPages30d = 0;
  let jinaEstimatedTokens30d = 0;

  for (const message of messages) {
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    for (const attachment of attachments) {
      if (attachment?.type !== 'web_search') {
        continue;
      }

      const metrics = collectSearchAttachmentMetrics(attachment);
      searches30d += metrics.searches;
      processedPages30d += metrics.processedPages;
      jinaEstimatedTokens30d += metrics.jinaEstimatedTokens;
    }
  }

  const firecrawlCostPerCreditUsd =
    firecrawl.costPerCreditUsd ?? getFirecrawlCostPerCredit(firecrawl.billingPeriod?.planCredits);
  const serperSpend30d = round(searches30d * SERPER_COST_PER_SEARCH_USD);
  const firecrawlEstimatedSpend30d =
    firecrawlCostPerCreditUsd != null ? round(processedPages30d * firecrawlCostPerCreditUsd) : null;
  const jinaEstimatedSpend30d = round(
    (jinaEstimatedTokens30d / 1_000_000) * JINA_COST_PER_MILLION_TOKENS_USD,
  );

  const estimatedSpendParts = [serperSpend30d, firecrawlEstimatedSpend30d, jinaEstimatedSpend30d]
    .filter((value) => value != null)
    .map(Number);

  return {
    status: searches30d > 0 || firecrawl.status === 'live' ? 'estimated' : 'pending',
    note: 'Search requests are reconstructed from stored web-search artifacts. Firecrawl billing-period credits are live from Firecrawl; Serper and Jina spend are estimated from public pricing and app activity.',
    searches30d,
    processedPages30d,
    serperSpend30d,
    jinaEstimatedTokens30d: roundWhole(jinaEstimatedTokens30d),
    jinaEstimatedSpend30d,
    firecrawlEstimatedSpend30d,
    firecrawl: {
      status: firecrawl.status,
      note: firecrawl.note,
      billingPeriod: firecrawl.billingPeriod,
      historical: firecrawl.historical,
    },
    totalEstimatedSpend30d:
      estimatedSpendParts.length > 0 ? round(estimatedSpendParts.reduce((sum, value) => sum + value, 0)) : null,
  };
}

async function getMongoMetrics() {
  const User = mongoose.models.User;
  const Message = mongoose.models.Message;
  const Conversation = mongoose.models.Conversation;

  if (!User || !Message || !Conversation) {
    return {
      status: 'unavailable',
      totals: {
        users: null,
        conversations: null,
        messages: null,
      },
      recent: {
        activeUsers7d: null,
        activeUsers30d: null,
        newUsers30d: null,
        newConversations30d: null,
        newMessages30d: null,
      },
    };
  }

  const last7d = daysAgo(7);
  const last30d = daysAgo(30);

  const [
    users,
    conversations,
    messages,
    activeUsers7d,
    activeUsers30d,
    newUsers30d,
    newConversations30d,
    newMessages30d,
  ] = await Promise.all([
    User.countDocuments(),
    Conversation.countDocuments(),
    Message.countDocuments(),
    Message.distinct('user', {
      isCreatedByUser: true,
      user: { $nin: [null, ''] },
      createdAt: { $gte: last7d },
    }),
    Message.distinct('user', {
      isCreatedByUser: true,
      user: { $nin: [null, ''] },
      createdAt: { $gte: last30d },
    }),
    User.countDocuments({ createdAt: { $gte: last30d } }),
    Conversation.countDocuments({ createdAt: { $gte: last30d } }),
    Message.countDocuments({ createdAt: { $gte: last30d } }),
  ]);

  return {
    status: 'live',
    totals: {
      users,
      conversations,
      messages,
    },
    recent: {
      activeUsers7d: activeUsers7d.length,
      activeUsers30d: activeUsers30d.length,
      newUsers30d,
      newConversations30d,
      newMessages30d,
    },
  };
}

async function checkHealth(name, url) {
  const start = Date.now();
  try {
    const response = await fetch(new URL('/health', url), { redirect: 'follow' });
    return {
      name,
      url,
      status: response.ok ? 'healthy' : 'degraded',
      code: response.status,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name,
      url,
      status: 'offline',
      code: null,
      latencyMs: null,
    };
  }
}

async function getPublicDashboardMetrics() {
  const [mongo, llm, search, infra, productionHealth, stagingHealth] = await Promise.all([
    getMongoMetrics(),
    getLiteLLMMetrics(),
    getSearchMetrics(),
    getRailwayInfraMetrics(),
    checkHealth('Production', PRODUCTION_URL),
    checkHealth('Staging', STAGING_URL),
  ]);

  return {
    updatedAt: new Date().toISOString(),
    summary: {
      users: mongo.totals.users,
      conversations: mongo.totals.conversations,
      messages: mongo.totals.messages,
      activeUsers7d: mongo.recent.activeUsers7d,
      activeUsers30d: mongo.recent.activeUsers30d,
      newUsers30d: mongo.recent.newUsers30d,
      newConversations30d: mongo.recent.newConversations30d,
      newMessages30d: mongo.recent.newMessages30d,
    },
    llm,
    search,
    infra,
    health: [productionHealth, stagingHealth],
    costCoverage: [
      {
        name: 'LLM gateway spend',
        status: llm.status === 'live' ? 'live' : 'pending',
        note: llm.note,
      },
      {
        name: 'App usage metrics',
        status: mongo.status === 'live' ? 'live' : 'pending',
        note: 'Users, conversations, messages, and recent activity come from MongoDB.',
      },
      {
        name: 'Search and crawl spend',
        status: search.status,
        note: search.note,
      },
      {
        name: 'Infrastructure billing',
        status: infra.status === 'live' ? 'live' : infra.status,
        note: infra.note,
      },
    ],
    methodology: [
      'Public metrics are intentionally aggregated and delayed to avoid exposing user-level data.',
      'LLM spend comes from LiteLLM daily activity analytics, not from hand-entered numbers.',
      'Search requests come from stored web-search artifacts; Serper and Jina spend are estimated from public pricing and recent app activity.',
      'Firecrawl billing-period credits come directly from the Firecrawl team usage API.',
      'Railway infrastructure usage, billing-period totals, and plan/credit context come directly from Railway GraphQL.',
      'Railway resource breakdown and projected month-end infrastructure usage are reconstructed from Railway usage metrics with Railway public pricing.',
    ],
  };
}

module.exports = {
  getPublicDashboardMetrics,
};
