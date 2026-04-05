const express = require('express');
const multer = require('multer');
const { logger } = require('@librechat/data-schemas');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const {
  getPageIndexConfig,
  uploadPolicyDocument,
  getPolicyDocument,
  queryPolicyDocument,
} = require('~/server/services/PolicyAnalyst/pageIndex');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.use(requireJwtAuth);

router.get('/config', (_req, res) => {
  const config = getPageIndexConfig();
  res.json({
    enabled: config.enabled,
  });
});

router.post('/documents', upload.single('file'), async (req, res) => {
  try {
    const config = getPageIndexConfig();

    if (!config.enabled) {
      return res.status(503).json({ message: 'Policy Analyst is not enabled' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'A PDF file is required' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ message: 'Policy Analyst currently supports PDF uploads only' });
    }

    const uploaded = await uploadPolicyDocument(req.file);
    const doc = await getPolicyDocument(uploaded.docId);

    return res.status(201).json({
      ...uploaded,
      ...doc,
    });
  } catch (error) {
    logger.error('[policy-analyst] Failed to upload document', error);
    return res.status(error.status || 500).json({
      message: error.message || 'Failed to upload document',
    });
  }
});

router.get('/documents/:docId', async (req, res) => {
  try {
    const doc = await getPolicyDocument(req.params.docId);
    return res.json(doc);
  } catch (error) {
    logger.error('[policy-analyst] Failed to fetch document status', error);
    return res.status(error.status || 500).json({
      message: error.message || 'Failed to fetch document status',
    });
  }
});

router.post('/query', async (req, res) => {
  try {
    const { docId, question } = req.body ?? {};

    if (!docId || !question || typeof question !== 'string') {
      return res.status(400).json({ message: 'docId and question are required' });
    }

    const result = await queryPolicyDocument({
      docId,
      question,
    });

    return res.json(result);
  } catch (error) {
    logger.error('[policy-analyst] Failed to query document', error);
    return res.status(error.status || 500).json({
      message: error.message || 'Failed to query document',
    });
  }
});

module.exports = router;
