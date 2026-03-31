const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');

const PRODUCTION_URL =
  process.env.PUBLIC_DASHBOARD_PRODUCTION_URL || 'https://2026gpt.jardenberg.se';
const STAGING_URL = process.env.PUBLIC_DASHBOARD_STAGING_URL || 'https://stage2026gpt.jardenberg.se';

const formatDate = (date) => date.toISOString().slice(0, 10);

const daysAgo = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

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
  const [mongo, llm, productionHealth, stagingHealth] = await Promise.all([
    getMongoMetrics(),
    getLiteLLMMetrics(),
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
        status: 'pending',
        note: 'Serper, Firecrawl, and Jina cost instrumentation is not public yet.',
      },
      {
        name: 'Infrastructure billing',
        status: 'pending',
        note: 'Railway billing is not yet wired into the public dashboard.',
      },
    ],
    methodology: [
      'Public metrics are intentionally aggregated and delayed to avoid exposing user-level data.',
      'LLM spend comes from LiteLLM daily activity analytics, not from hand-entered numbers.',
      'Search, crawl, rerank, and infrastructure costs are not yet part of the live total, and are marked accordingly.',
    ],
  };
}

module.exports = {
  getPublicDashboardMetrics,
};
