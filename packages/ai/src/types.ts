export const CONTENT_FORMATS = [
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
] as const;

export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const HOOK_TYPES = [
  "QUESTION",
  "CURIOSITY",
  "SHOCK",
  "PROBLEM",
  "PROMISE",
  "LIST",
  "STORY",
  "CONTRAST",
  "DIRECT_STATEMENT",
  "OTHER",
] as const;

export type HookType = (typeof HOOK_TYPES)[number];

export const SENTIMENTS = ["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED"] as const;

export type Sentiment = (typeof SENTIMENTS)[number];

export interface VideoClassificationInput {
  caption?: string | null;
  description?: string | null;
  location?: string | null;
  hashtags: string[];
  creatorUsername?: string | null;
  duration?: number | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  engagementRate?: number | null;
}

export interface VideoClassification {
  topic: string;
  subTopic: string | null;
  destination: string | null;
  contentFormat: ContentFormat;
  hookType: HookType;
  hookText: string | null;
  ctaType: string | null;
  sentiment: Sentiment;
  targetAudience: string | null;
  estimatedIntent: string | null;
  aiScore: number | null;
  summary: string | null;
}

export interface ProjectInsightInput {
  projectName: string;
  videoCount: number;
  creatorCount: number;
  totalViews: number;
  avgEngagementRate: number | null;
  topCreator: string | null;
  topHashtags: string[];
  periodDays: number;
}

export interface ProjectInsight {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  predictedBestFormat: ContentFormat;
  predictedBestHook: HookType;
  opportunity: number;
}

// --- Phase 7: content ideation, scripts, captions, planner -------------------

export const CTAS = [
  "FOLLOW",
  "COMMENT",
  "SAVE",
  "SHARE",
  "BOOK",
  "LINK_IN_BIO",
] as const;

export type CtaType = (typeof CTAS)[number];

export interface ContentIdeaDraft {
  title: string;
  topic: string | null;
  destination: string | null;
  format: ContentFormat;
  hook: string | null;
  hookType: HookType;
  concept: string | null;
  targetAudience: string | null;
  cta: CtaType | null;
  estimatedDuration: number | null;
  opportunityScore: number;
  aiReasoning: string | null;
  hashtags: string[];
}

export interface ContentIdeaGeneratorInput {
  projectName: string;
  niche: string | null;
  topHashtags: string[];
  topDestinations: string[];
  formatMix: ContentFormat[];
  count: number;
  randomness: string;
  /** Language for the generated text (e.g. "English", "Bahasa Indonesia"). */
  language?: string;
  /** Analyzed scraped videos to use as references for ideas. */
  references?: ContentVideoReference[];
}

export interface ContentVideoReference {
  videoId: string;
  caption: string | null;
  creatorUsername: string | null;
  destination: string | null;
  topic: string | null;
  contentFormat: ContentFormat | null;
  hookType: HookType | null;
  hookText: string | null;
  summary: string | null;
  views: number | null;
  likes: number | null;
  hashtags: string[];
}

export interface ScriptVideoReference {
  caption: string | null;
  creatorUsername: string | null;
  destination: string | null;
  topic: string | null;
  contentFormat: ContentFormat | null;
  hookType: HookType | null;
  hookText: string | null;
  summary: string | null;
  hashtags: string[];
}

export interface ScriptSection {
  section: string;
  durationSeconds: number;
  description: string;
}

export interface VideoScript {
  hook: string;
  outline: ScriptSection[];
  cta: CtaType;
  tone: string;
}

export interface ScriptGeneratorInput {
  ideaTitle: string;
  hook: string | null;
  format: ContentFormat;
  topic: string | null;
  destination: string | null;
  targetAudience: string | null;
  cta: CtaType | null;
  randomness: string;
  /** Language for the generated text (e.g. "English", "Bahasa Indonesia"). */
  language?: string;
  /** Analyzed source video the script should adapt its angle from. */
  referenceVideo?: ScriptVideoReference;
}

export interface VideoCaption {
  caption: string;
  hashtags: string[];
  cta: CtaType;
}

export interface CaptionGeneratorInput {
  ideaTitle: string;
  topic: string | null;
  destination: string | null;
  format: ContentFormat;
  hook: string | null;
  cta: CtaType | null;
  hashtags: string[];
  randomness: string;
  /** Language for the generated text (e.g. "English", "Bahasa Indonesia"). */
  language?: string;
}

export interface PlannerIdea {
  id: string;
  title: string;
  format: ContentFormat | null;
  opportunityScore: number | null;
}

export interface ContentPlanDraftItem {
  contentIdeaId: string;
  scheduledDate: string;
  title: string;
}

export interface ContentPlanDraft {
  title: string;
  description: string | null;
  items: ContentPlanDraftItem[];
}

export interface ContentPlannerInput {
  projectName: string;
  niche: string | null;
  startDate: Date;
  endDate: Date;
  postsPerWeek: number;
  ideas: PlannerIdea[];
  randomness: string;
  /** Language for the generated text (e.g. "English", "Bahasa Indonesia"). */
  language?: string;
}
