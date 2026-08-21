import {
  ContentFormat,
  HookType,
  Sentiment,
  VideoClassification,
  VideoClassificationInput,
} from "./types";

const DESTINATIONS = [
  "raja ampat",
  "labuan bajo",
  "bromo",
  "ijen",
  "nusa penida",
  "nusa lembongan",
  "gili",
  "lombok",
  "komodo",
  "flores",
  "bali",
  "ubud",
  "seminyak",
  "canggu",
  "jakarta",
  "yogyakarta",
  "jogja",
  "borobudur",
  "prambanan",
  "bandung",
  "surabaya",
  "sumatra",
  "toraja",
  "bunaken",
  "wakatobi",
  "belitung",
  "sumba",
  "rinjani",
  "dieng",
  "ciletuh",
  "seribu",
] as const;

const FORMAT_RULES: Array<[RegExp, ContentFormat]> = [
  [/top \d|list|must-?try|best .{0,20}(list|bucket)|things to do/i, "LISTICLE"],
  [/how to|step by step|tips?|guide|tutorial|hack/i, "TUTORIAL"],
  [/review|honest|worth it|rating/i, "REVIEW"],
  [/pov/i, "POV"],
  [/day (in|with)|vlog|follow me/i, "VLOG"],
  [/before[\s&]*after|transformation/i, "BEFORE_AFTER"],
  [/cinematic|aerial|drone/i, "CINEMATIC"],
  [/my story|the story|storytime/i, "STORYTELLING"],
  [/talking|interview|speaking/i, "TALKING_HEAD"],
  [/voiceover|voice over|narration/i, "VOICE_OVER"],
];

const HOOK_RULES: Array<[RegExp, HookType]> = [
  [/you won'?t believe|wait till|no one tells you|nobody talks about/i, "SHOCK"],
  [/^how |how to/i, "PROBLEM"],
  [/why /i, "CURIOSITY"],
  [/top \d|list of|\d+ (hidden |things |places)/i, "LIST"],
  [/secret|hidden|underrated/i, "CURIOSITY"],
  [/save this|pin this|bookmark/i, "PROMISE"],
  [/\?/, "QUESTION"],
  [/story|the day/i, "STORY"],
  [/vs\.|better than|instead of/i, "CONTRAST"],
];

const POSITIVE_WORDS = [
  "hidden gem",
  "beautiful",
  "amazing",
  "paradise",
  "stunning",
  "magical",
  "breathtaking",
  "perfect",
  "must-?visit",
  "dream",
  "crystal clear",
] as const;

const NEGATIVE_WORDS = [
  "overrated",
  "crowded",
  "trap",
  "disappointed",
  "bad",
  "waste",
  "avoid",
  "not worth",
  "expensive",
  "dirty",
] as const;

const CTA_RULES: Array<[RegExp, string]> = [
  [/link in bio/i, "LINK_IN_BIO"],
  [/follow /i, "FOLLOW"],
  [/save this|save for/i, "SAVE"],
  [/comment /i, "COMMENT"],
  [/share /i, "SHARE"],
  [/book|tickets|reserve|price|cost/i, "BOOK"],
];

const INTENT_RULES: Array<[RegExp, string]> = [
  [/book|tickets|reserve|stay|price|cost|hotel/i, "booking"],
  [/what to do|things to do|itinerary|plan|tips|guide|route/i, "planning"],
  [/hidden|secret|underrated|must|recommend|best|worth/i, "inspiration"],
];

const SUBTOPIC_RULES: Array<[RegExp, string]> = [
  [/food|street food|eat|restaurant|culinary|kuliner/i, "Food & culinary"],
  [/beach|island|dive|snorkel|surf/i, "Beach & islands"],
  [/hike|trek|mountain|volcano|trail/i, "Hiking & adventure"],
  [/hotel|villa|resort|stay|accommodation|glamping/i, "Hotels & stays"],
  [/culture|temple|heritage|traditional|ceremony/i, "Culture & heritage"],
  [/nightlife|bar|party|club/i, "Nightlife"],
];

function hash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function firstMatch(text: string, rules: Array<[RegExp, string]>): string | null {
  for (const [pattern, label] of rules) {
    if (pattern.test(text)) return label;
  }
  return null;
}

export function firstSentence(caption: string | null | undefined): string | null {
  if (!caption) return null;
  const first = caption.split(/[.!?\n]/)[0]?.trim();
  if (!first) return null;
  return first.length > 80 ? `${first.slice(0, 77)}...` : first;
}

/**
 * Deterministic, offline classifier used when `AI_MODE=mock` (or when no API
 * key is configured). Keyword heuristics over caption/description/location.
 */
export class MockVideoClassifier {
  async classify(input: VideoClassificationInput): Promise<VideoClassification> {
    const text = `${input.caption ?? ""} ${input.description ?? ""} ${input.location ?? ""}`.trim().toLowerCase();

    const destination =
      DESTINATIONS.find((name) => text.includes(name)) ?? null;

    const contentFormat =
      (firstMatch(text, FORMAT_RULES) as ContentFormat | null) ?? "OTHER";
    const hookType =
      (firstMatch(text, HOOK_RULES) as HookType | null) ?? "OTHER";

    const positiveHits = POSITIVE_WORDS.filter((word) => new RegExp(word, "i").test(text)).length;
    const negativeHits = NEGATIVE_WORDS.filter((word) => new RegExp(word, "i").test(text)).length;
    const sentiment: Sentiment =
      positiveHits === 0 && negativeHits === 0
        ? "NEUTRAL"
        : positiveHits > negativeHits
          ? "POSITIVE"
          : negativeHits > positiveHits
            ? "NEGATIVE"
            : "MIXED";

    const ctaType = firstMatch(text, CTA_RULES);
    const estimatedIntent = firstMatch(text, INTENT_RULES) ?? "awareness";

    const topic =
      destination && destination.length > 0
        ? `${destination.charAt(0).toUpperCase()}${destination.slice(1)} travel`
        : input.hashtags.find((tag) => /travel|indonesia|wander/.test(tag.toLowerCase())) ?? "Travel";
    const subTopic = firstMatch(text, SUBTOPIC_RULES);

    const engagementRate = input.engagementRate;
    const aiScore =
      typeof engagementRate === "number" && !Number.isNaN(engagementRate)
        ? Math.min(95, Math.max(20, Math.round(engagementRate * 8 * 10) / 10))
        : 45 + (hash(text) % 36);

    const hookText = firstSentence(input.caption);
    const summary = `Primarily a ${contentFormat.toLowerCase()} about ${topic.toLowerCase()}${destination ? ` in ${destination}` : ""}; ${sentiment.toLowerCase()} tone with a ${hookType.toLowerCase()} hook.`;

    return {
      topic,
      subTopic,
      destination,
      contentFormat,
      hookType,
      hookText,
      ctaType,
      sentiment,
      targetAudience: destination ? `${destination.charAt(0).toUpperCase()}${destination.slice(1)} visitors` : "Travelers",
      estimatedIntent,
      aiScore,
      summary,
    };
  }
}
