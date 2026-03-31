const mongoose = require('mongoose');

const ROADMAP_STATUS = {
  IN_PROGRESS: 'in-progress',
  NEXT: 'next',
  LATER: 'later',
  UNDER_CONSIDERATION: 'under-consideration',
  SHIPPED: 'shipped',
};

const ROADMAP_KIND = {
  WORKFLOW: 'workflow',
  PLATFORM: 'platform',
  FEATURE: 'feature',
  BUG: 'bug',
};

const DEFAULT_ROADMAP_ITEMS = [
  {
    slug: 'public-transparency-dashboard',
    title: 'Public transparency dashboard',
    description:
      'Ship a public-facing metrics surface that shows live usage, model mix, cost coverage, and operational health without exposing internal secrets.',
    status: ROADMAP_STATUS.IN_PROGRESS,
    kind: ROADMAP_KIND.PLATFORM,
    priority: 'high',
    source: 'team',
    targetWindow: 'Q2 2026',
    displayOrder: 10,
    tags: ['transparency', 'metrics', 'costs'],
  },
  {
    slug: 'public-roadmap-and-idea-board',
    title: 'Public roadmap and idea board',
    description:
      'Create a public roadmap where users can track delivery, vote on priorities, comment on ideas, and submit their own requests.',
    status: ROADMAP_STATUS.IN_PROGRESS,
    kind: ROADMAP_KIND.FEATURE,
    priority: 'high',
    source: 'team',
    targetWindow: 'Q2 2026',
    displayOrder: 20,
    tags: ['community', 'roadmap', 'feedback'],
  },
  {
    slug: 'document-analyst-workflow',
    title: 'Document Analyst workflow',
    description:
      'Turn upload-and-chat into a first-class workflow for summarizing long documents, extracting actions, and comparing files.',
    status: ROADMAP_STATUS.NEXT,
    kind: ROADMAP_KIND.WORKFLOW,
    priority: 'high',
    source: 'team',
    targetWindow: 'Q2 2026',
    displayOrder: 30,
    tags: ['documents', 'analysis', 'workflow'],
  },
  {
    slug: 'translation-workflow',
    title: 'Document translation workflow',
    description:
      'Add a structured translation flow for PDF and DOCX files with language selection, progress feedback, and downloadable outputs.',
    status: ROADMAP_STATUS.UNDER_CONSIDERATION,
    kind: ROADMAP_KIND.WORKFLOW,
    priority: 'medium',
    source: 'team',
    targetWindow: 'Q2-Q3 2026',
    displayOrder: 40,
    tags: ['translation', 'documents', 'enterprise'],
  },
  {
    slug: 'research-assistant-workflow',
    title: 'Research Assistant workflow',
    description:
      'Package web search, citations, and comparison prompts into a workflow that feels intentional rather than generic chat.',
    status: ROADMAP_STATUS.LATER,
    kind: ROADMAP_KIND.WORKFLOW,
    priority: 'medium',
    source: 'team',
    targetWindow: 'Q3 2026',
    displayOrder: 50,
    tags: ['research', 'workflow', 'citations'],
  },
  {
    slug: 'full-cost-coverage',
    title: 'Full cost coverage beyond LLM spend',
    description:
      'Instrument search, crawling, reranking, code execution, and infrastructure billing so the public dashboard can show true end-to-end cost coverage.',
    status: ROADMAP_STATUS.NEXT,
    kind: ROADMAP_KIND.PLATFORM,
    priority: 'high',
    source: 'team',
    targetWindow: 'Q2 2026',
    displayOrder: 60,
    tags: ['observability', 'infra', 'costs'],
  },
];

const voteSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const commentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['published', 'hidden'],
      default: 'published',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const roadmapItemSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      index: true,
      sparse: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 160,
    },
    description: {
      type: String,
      required: true,
      maxlength: 4000,
    },
    status: {
      type: String,
      enum: Object.values(ROADMAP_STATUS),
      default: ROADMAP_STATUS.UNDER_CONSIDERATION,
      index: true,
    },
    kind: {
      type: String,
      enum: Object.values(ROADMAP_KIND),
      default: ROADMAP_KIND.FEATURE,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    source: {
      type: String,
      enum: ['team', 'community'],
      default: 'community',
    },
    targetWindow: {
      type: String,
      default: null,
    },
    displayOrder: {
      type: Number,
      default: 1000,
    },
    isPublic: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: String,
      default: null,
    },
    createdByName: {
      type: String,
      default: null,
    },
    votes: {
      type: [voteSchema],
      default: [],
    },
    comments: {
      type: [commentSchema],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

roadmapItemSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: 'string' } } });
roadmapItemSchema.index({ isPublic: 1, status: 1, displayOrder: 1, createdAt: -1 });

const RoadmapItem =
  mongoose.models.PublicRoadmapItem ||
  mongoose.model('PublicRoadmapItem', roadmapItemSchema, 'public_roadmap_items');

async function ensureDefaultRoadmapItems() {
  await Promise.all(
    DEFAULT_ROADMAP_ITEMS.map((item) =>
      RoadmapItem.findOneAndUpdate({ slug: item.slug }, { $setOnInsert: item }, { upsert: true }),
    ),
  );
}

function toPublicRoadmapItem(item, viewerUserId) {
  const votes = Array.isArray(item.votes) ? item.votes : [];
  const comments = Array.isArray(item.comments) ? item.comments : [];
  const publishedComments = comments
    .filter((comment) => comment.status !== 'hidden')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return {
    id: String(item._id),
    slug: item.slug ?? null,
    title: item.title,
    description: item.description,
    status: item.status,
    kind: item.kind,
    priority: item.priority,
    source: item.source,
    targetWindow: item.targetWindow,
    displayOrder: item.displayOrder,
    tags: item.tags ?? [],
    createdByName: item.createdByName,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    voteCount: votes.length,
    viewerHasVoted: viewerUserId ? votes.some((vote) => vote.userId === viewerUserId) : false,
    commentCount: publishedComments.length,
    comments: publishedComments.map((comment) => ({
      id: String(comment._id),
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt,
    })),
  };
}

module.exports = {
  DEFAULT_ROADMAP_ITEMS,
  ROADMAP_KIND,
  ROADMAP_STATUS,
  RoadmapItem,
  ensureDefaultRoadmapItems,
  toPublicRoadmapItem,
};
