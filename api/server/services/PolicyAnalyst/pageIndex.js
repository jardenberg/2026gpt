const fetch = require('node-fetch');
const FormData = require('form-data');

function getPageIndexConfig() {
  const apiKey = process.env.PAGEINDEX_API_KEY;
  const baseUrl = (process.env.PAGEINDEX_BASE_URL || 'https://api.pageindex.ai').replace(
    /\/+$/,
    '',
  );

  return {
    enabled: Boolean(apiKey),
    apiKey,
    baseUrl,
  };
}

function ensureEnabled() {
  const config = getPageIndexConfig();

  if (!config.enabled) {
    const error = new Error('Policy Analyst is not enabled');
    error.status = 503;
    throw error;
  }

  return config;
}

async function parseResponse(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: text || 'Unexpected upstream response' };
  }
}

async function pageIndexRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const config = ensureEnabled();
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    body,
    headers: {
      api_key: config.apiKey,
      ...headers,
    },
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const error = new Error(data?.message || `PageIndex request failed with ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function normalizeOutlineNode(node) {
  return {
    nodeId: node.node_id,
    title: node.title,
    pageIndex: node.page_index ?? null,
    children: Array.isArray(node.nodes) ? node.nodes.map(normalizeOutlineNode) : [],
  };
}

function normalizeTreeResponse(data) {
  const outline = Array.isArray(data.result) ? data.result.map(normalizeOutlineNode) : [];

  return {
    docId: data.doc_id,
    status: data.status,
    retrievalReady: data.retrieval_ready === true,
    title: outline[0]?.title ?? null,
    outline,
  };
}

async function uploadPolicyDocument(file) {
  const form = new FormData();
  form.append('file', file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  const data = await pageIndexRequest('/doc/', {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  return {
    docId: data.doc_id,
    filename: file.originalname,
  };
}

async function getPolicyDocument(docId) {
  const data = await pageIndexRequest(`/doc/${encodeURIComponent(docId)}/?type=tree`);
  return normalizeTreeResponse(data);
}

async function queryPolicyDocument({ docId, question }) {
  const data = await pageIndexRequest('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      doc_id: docId,
      enable_citations: true,
      stream: false,
      messages: [{ role: 'user', content: question }],
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const message = data?.choices?.[0]?.message?.content ?? '';

  return {
    answer: message,
    citations: Array.isArray(data?.citations) ? data.citations : [],
    usage: data?.usage ?? null,
    completionId: data?.id ?? null,
  };
}

module.exports = {
  getPageIndexConfig,
  uploadPolicyDocument,
  getPolicyDocument,
  queryPolicyDocument,
};
