const express = require('express');
const { SystemRoles } = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const optionalJwtAuth = require('~/server/middleware/optionalJwtAuth');
const { getPublicDashboardMetrics } = require('~/server/services/publicDashboard');
const {
  ROADMAP_KIND,
  ROADMAP_STATUS,
  RoadmapItem,
  ensureDefaultRoadmapItems,
  toPublicRoadmapItem,
} = require('~/server/models/publicRoadmap');

const router = express.Router();
const DEFAULT_PUBLIC_SURFACES_TARGET = 'https://2026gpt.jardenberg.se';

const statusOrder = {
  [ROADMAP_STATUS.IN_PROGRESS]: 0,
  [ROADMAP_STATUS.NEXT]: 1,
  [ROADMAP_STATUS.LATER]: 2,
  [ROADMAP_STATUS.UNDER_CONSIDERATION]: 3,
  [ROADMAP_STATUS.SHIPPED]: 4,
};

const trimText = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizePublicSurfaceMode = (value) => (trimText(value) === 'placeholder' ? 'placeholder' : 'live');
const normalizePublicSurfaceTarget = (value) => {
  const trimmed = trimText(value);
  return trimmed ? trimmed.replace(/\/+$/, '') : DEFAULT_PUBLIC_SURFACES_TARGET;
};

const getAuthorName = (user) =>
  trimText(user?.name) ||
  trimText(user?.username) ||
  trimText(user?.email)?.split('@')[0] ||
  '2026GPT user';

const isAdmin = (user) => user?.role === SystemRoles.ADMIN;

router.get('/dashboard', async (_req, res) => {
  try {
    const metrics = await getPublicDashboardMetrics();
    res.status(200).json(metrics);
  } catch (error) {
    logger.error('Error getting public dashboard metrics:', error);
    res.status(500).json({ message: 'Error getting public dashboard metrics' });
  }
});

router.get('/surface-config', (_req, res) => {
  res.status(200).json({
    dashMode: normalizePublicSurfaceMode(
      process.env.PUBLIC_DASH_MODE ?? process.env.VITE_PUBLIC_DASH_MODE,
    ),
    roadmapMode: normalizePublicSurfaceMode(
      process.env.PUBLIC_ROADMAP_MODE ?? process.env.VITE_PUBLIC_ROADMAP_MODE,
    ),
    targetBase: normalizePublicSurfaceTarget(
      process.env.PUBLIC_SURFACES_TARGET ?? process.env.VITE_PUBLIC_SURFACES_TARGET,
    ),
  });
});

router.get('/roadmap', optionalJwtAuth, async (req, res) => {
  try {
    await ensureDefaultRoadmapItems();
    const items = await RoadmapItem.find({ isPublic: true }).lean();
    const viewerUserId = req.user?.id ?? null;
    const serialized = items
      .map((item) => toPublicRoadmapItem(item, viewerUserId))
      .sort((a, b) => {
        const statusDelta = (statusOrder[a.status] ?? 999) - (statusOrder[b.status] ?? 999);
        if (statusDelta !== 0) {
          return statusDelta;
        }
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        if (a.voteCount !== b.voteCount) {
          return b.voteCount - a.voteCount;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    res.status(200).json({
      viewer: {
        isAuthenticated: Boolean(req.user),
        isAdmin: isAdmin(req.user),
        name: req.user ? getAuthorName(req.user) : null,
      },
      items: serialized,
    });
  } catch (error) {
    logger.error('Error getting public roadmap:', error);
    res.status(500).json({ message: 'Error getting public roadmap' });
  }
});

router.post('/roadmap', requireJwtAuth, async (req, res) => {
  try {
    const title = trimText(req.body?.title);
    const description = trimText(req.body?.description);
    const kind = Object.values(ROADMAP_KIND).includes(req.body?.kind)
      ? req.body.kind
      : ROADMAP_KIND.FEATURE;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const item = await RoadmapItem.create({
      title,
      description,
      kind,
      status: ROADMAP_STATUS.UNDER_CONSIDERATION,
      source: 'community',
      createdBy: req.user.id,
      createdByName: getAuthorName(req.user),
      isPublic: true,
      tags: [],
    });

    return res.status(201).json(toPublicRoadmapItem(item.toObject(), req.user.id));
  } catch (error) {
    logger.error('Error creating roadmap idea:', error);
    return res.status(500).json({ message: 'Error creating roadmap idea' });
  }
});

router.patch('/roadmap/:itemId', requireJwtAuth, async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ message: 'Only admins can edit roadmap items.' });
  }

  const updates = {};
  const allowedKeys = ['title', 'description', 'status', 'kind', 'priority', 'targetWindow', 'tags'];
  for (const key of allowedKeys) {
    if (!(key in req.body)) {
      continue;
    }

    if (key === 'tags' && Array.isArray(req.body.tags)) {
      updates.tags = req.body.tags.map((tag) => trimText(tag)).filter(Boolean);
      continue;
    }

    updates[key] = trimText(req.body[key]);
  }

  if (updates.status && !Object.values(ROADMAP_STATUS).includes(updates.status)) {
    return res.status(400).json({ message: 'Invalid roadmap status.' });
  }

  if (updates.kind && !Object.values(ROADMAP_KIND).includes(updates.kind)) {
    return res.status(400).json({ message: 'Invalid roadmap kind.' });
  }

  try {
    const item = await RoadmapItem.findByIdAndUpdate(req.params.itemId, updates, { new: true });
    if (!item) {
      return res.status(404).json({ message: 'Roadmap item not found.' });
    }

    return res.status(200).json(toPublicRoadmapItem(item.toObject(), req.user.id));
  } catch (error) {
    logger.error('Error updating roadmap item:', error);
    return res.status(500).json({ message: 'Error updating roadmap item' });
  }
});

router.post('/roadmap/:itemId/vote', requireJwtAuth, async (req, res) => {
  try {
    const item = await RoadmapItem.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Roadmap item not found.' });
    }

    if (!item.votes.some((vote) => vote.userId === req.user.id)) {
      item.votes.push({ userId: req.user.id });
      await item.save();
    }

    return res.status(200).json(toPublicRoadmapItem(item.toObject(), req.user.id));
  } catch (error) {
    logger.error('Error voting on roadmap item:', error);
    return res.status(500).json({ message: 'Error voting on roadmap item' });
  }
});

router.delete('/roadmap/:itemId/vote', requireJwtAuth, async (req, res) => {
  try {
    const item = await RoadmapItem.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Roadmap item not found.' });
    }

    item.votes = item.votes.filter((vote) => vote.userId !== req.user.id);
    await item.save();

    return res.status(200).json(toPublicRoadmapItem(item.toObject(), req.user.id));
  } catch (error) {
    logger.error('Error removing vote from roadmap item:', error);
    return res.status(500).json({ message: 'Error removing vote from roadmap item' });
  }
});

router.post('/roadmap/:itemId/comments', requireJwtAuth, async (req, res) => {
  try {
    const body = trimText(req.body?.body);
    if (!body) {
      return res.status(400).json({ message: 'Comment body is required.' });
    }

    const item = await RoadmapItem.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Roadmap item not found.' });
    }

    item.comments.push({
      userId: req.user.id,
      authorName: getAuthorName(req.user),
      body,
    });
    await item.save();

    return res.status(201).json(toPublicRoadmapItem(item.toObject(), req.user.id));
  } catch (error) {
    logger.error('Error commenting on roadmap item:', error);
    return res.status(500).json({ message: 'Error commenting on roadmap item' });
  }
});

module.exports = router;
