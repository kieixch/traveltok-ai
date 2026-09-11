export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorPayload {
  success: false;
  message: string;
  code?: string;
  details?: unknown;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  aiProvider?: string;
  createdAt: string;
}

export type AiProvider = "mock" | "openai" | "gemini";

export interface AiProviderInfo {
  value: AiProvider;
  label: string;
  model: string;
  models: string[];
  available: boolean;
}

export interface AiProvidersInfo {
  current: AiProvider;
  providers: AiProviderInfo[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  niche: string | null;
  createdById: string;
  isSeedData: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Overview {
  projectId: string;
  videoCount: number;
  creatorCount: number;
  hashtagCount: number;
  completedJobs: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  avgViews: number;
  avgEngagementRate: number;
  videosLast30d: number;
  topVideo: {
    id: string;
    caption: string | null;
    url: string | null;
    views: number;
    creatorUsername: string | null;
  } | null;
  topCreator: {
    id: string;
    username: string;
    profileUrl: string | null;
    followers: number | null;
    videoCount: number;
  } | null;
}

export interface EngagementBucket {
  bucket: string;
  count: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  avgEngagementRate: number;
}

export interface CreatorPerformance {
  id: string;
  externalId: string | null;
  username: string;
  displayName: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  followers: number | null;
  videoCount: number;
  totalViews: number;
  avgViews: number;
  avgEngagementRate: number;
}

export interface Creator {
  id: string;
  externalId: string | null;
  username: string;
  displayName: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  followers: number | null;
  following: number | null;
  totalLikes: number | null;
  videoCount: number;
  totalViews: number;
  avgEngagementRate: number;
  createdAt: string;
}

export interface HashtagPerformance {
  id: string;
  name: string;
  normalizedName: string;
  videoCount: number;
  totalViews: number;
  avgEngagementRate: number;
}

export interface TrendScoreResult {
  matchingVideos: number;
  totalVideos: number;
  matchingCreators: number;
  totalCreators: number;
  growthRate: number;
  engagementScore: number;
  frequencyScore: number;
  recencyScore: number;
  contentGapScore: number;
  trendScore: number;
  opportunityScore: number;
}

export interface Trend {
  id: string;
  projectId: string;
  keyword: string;
  type: string;
  trendScore: number | null;
  growthRate: number | null;
  engagementScore: number | null;
  frequencyScore: number | null;
  recencyScore: number | null;
  opportunityScore: number | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface ContentIdeaSourceVideo {
  id: string;
  url: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  creator: { username: string | null };
  metrics: { views: number; likes: number }[];
}

export interface ContentIdea {
  id: string;
  projectId: string;
  title: string;
  topic: string | null;
  destination: string | null;
  format: string | null;
  hook: string | null;
  concept: string | null;
  targetAudience: string | null;
  cta: string | null;
  estimatedDuration: number | null;
  opportunityScore: number | null;
  aiReasoning: string | null;
  script: string | null;
  scriptOutline: { scene: string; duration: number; visual: string; action: string }[] | null;
  caption: string | null;
  hashtags: string[];
  generatedBy: string;
  aiModel: string | null;
  status: string;
  sourceVideoId: string | null;
  sourceVideo: ContentIdeaSourceVideo | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentPlanItem {
  id: string;
  contentPlanId: string;
  contentIdeaId: string | null;
  scheduledDate: string;
  title: string;
  hook: string | null;
  script: string | null;
  caption: string | null;
  hashtags: string | null;
  cta: string | null;
  format: string | null;
  status: string;
  generatedBy: string;
  createdAt: string;
}

export interface ContentPlan {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: string;
  generatedBy: string;
  aiModel: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

export interface ContentPlanDetail extends ContentPlan {
  project: { id: string; name: string };
  items: ContentPlanItem[];
}

export interface ContentAnalysis {
  id: string;
  videoId: string;
  topic: string | null;
  subTopic: string | null;
  destination: string | null;
  contentFormat: string | null;
  hookType: string | null;
  hookText: string | null;
  ctaType: string | null;
  sentiment: string | null;
  targetAudience: string | null;
  estimatedIntent: string | null;
  aiScore: number | null;
  analysisVersion: string;
  model: string | null;
  createdAt: string;
}

export interface ProjectInsights {
  projectId: string;
  formats: { format: string; count: number }[];
  topTopics: { topic: string; count: number }[];
  topDestinations: { destination: string; count: number }[];
  hookTypes: { hookType: string; count: number }[];
  sentimentBreakdown: { sentiment: string; count: number }[];
  strongestVideo: { id: string; caption: string | null; aiScore: number | null } | null;
  weakestVideo: { id: string; caption: string | null; aiScore: number | null } | null;
  recommendations: string[];
}

export interface ScrapingJob {
  id: string;
  projectId: string;
  keyword: string | null;
  hashtag: string | null;
  maxResults: number | null;
  status: string;
  apifyRunId: string | null;
  totalResults: number | null;
  processedResults: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export type EmbeddingEntityType = "VIDEO" | "IDEA" | "TREND";

export const EMBEDDING_ENTITY_TYPES: EmbeddingEntityType[] = [
  "VIDEO",
  "IDEA",
  "TREND",
];

export interface SearchHit {
  entityType: EmbeddingEntityType;
  entityId: string;
  score: number;
  content: string;
  model: string;
  entity: {
    id: string;
    caption?: string | null;
    description?: string | null;
    location?: string | null;
    thumbnailUrl?: string | null;
    url?: string | null;
    publishedAt?: string | null;
    duration?: number | null;
    creatorUsername?: string | null;
    views?: number | null;
    likes?: number | null;
    title?: string | null;
    topic?: string | null;
    destination?: string | null;
    format?: string | null;
    status?: string | null;
    opportunityScore?: number | null;
    hashtags?: string[] | null;
    keyword?: string | null;
    type?: string | null;
    trendScore?: number | null;
  } | null;
}

export interface SearchIndexMeta {
  indexed: boolean;
  videos: number;
  ideas: number;
  trends: number;
  total: number;
  model: string | null;
}

export type OpportunityType =
  | "DESTINATION"
  | "HASHTAG"
  | "TOPIC"
  | "FORMAT"
  | "HOOK";

export interface Opportunity {
  type: OpportunityType;
  label: string;
  opportunityScore: number;
  demandScore: number;
  engagementScore: number;
  growthScore: number;
  coverage: number;
  coverageRatio: number;
  avgEngagementRate: number;
  trendScore: number | null;
  reasoning: string;
  topVideos: Array<{
    id: string;
    caption: string | null;
    views: number;
  }>;
}

export type ContentFormat =
  | "POV"
  | "VLOG"
  | "LISTICLE"
  | "TUTORIAL"
  | "REVIEW"
  | "STORYTELLING"
  | "CINEMATIC"
  | "TALKING_HEAD"
  | "VOICE_OVER"
  | "BEFORE_AFTER"
  | "OTHER";

export const CONTENT_FORMATS: ContentFormat[] = [
  "POV",
  "VLOG",
  "LISTICLE",
  "TUTORIAL",
  "REVIEW",
  "STORYTELLING",
  "CINEMATIC",
  "TALKING_HEAD",
  "VOICE_OVER",
  "BEFORE_AFTER",
  "OTHER",
];

export const CONTENT_LANGUAGES: string[] = [
  "English",
  "Bahasa Indonesia",
  "Español",
  "Français",
  "Português",
  "Deutsch",
  "中文",
  "日本語",
  "한국어",
  "हिन्दी",
  "العربية",
];
