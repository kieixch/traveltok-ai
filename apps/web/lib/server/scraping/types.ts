export interface NormalizedTikTokCreator {
  externalId: string;
  username?: string | null;
  displayName?: string | null;
  profileUrl?: string | null;
  avatarUrl?: string | null;
  followers?: number | null;
  following?: number | null;
  totalLikes?: bigint | null;
  videoCount?: number | null;
}

export interface NormalizedTikTokMetrics {
  views: bigint;
  likes: bigint;
  comments: bigint;
  shares: bigint;
  saves?: bigint | null;
  engagementRate?: number | null;
}

export interface NormalizedTikTokVideo {
  externalId: string;
  url?: string | null;
  thumbnailUrl?: string | null;
  caption?: string | null;
  description?: string | null;
  duration?: number | null;
  publishedAt?: Date | null;
  musicName?: string | null;
  location?: string | null;
  creator: NormalizedTikTokCreator;
  metrics: NormalizedTikTokMetrics;
  hashtags: string[];
}

export interface ScrapeInput {
  keyword?: string | null;
  hashtag?: string | null;
  maxResults: number;
}

export interface ScrapeResult {
  items: NormalizedTikTokVideo[];
  apifyRunId?: string;
}

export interface TikTokScraper {
  scrape(input: ScrapeInput): Promise<ScrapeResult>;
}