import {
  NormalizedTikTokCreator,
  NormalizedTikTokMetrics,
  NormalizedTikTokVideo,
} from "./types";

type UnknownRecord = Record<string, unknown>;

/**
 * Maps raw Apify TikTok dataset items to the internal normalized shape.
 *
 * The Apify actor output format varies between actors and over time, so the
 * mapper reads several known key variants and is deliberately tolerant of
 * missing fields. Returns null when a stable external id cannot be derived
 * (the caller filters those items out).
 */
export class TikTokDataMapper {
  map(raw: unknown): NormalizedTikTokVideo | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const item = raw as UnknownRecord;
    const stats = this.record(item.stats ?? item.statistics ?? {});
    const author = this.record(item.author ?? item.creator ?? item.authorMeta ?? {});
    const authorStats = this.record(
      item.authorStats ?? stats.author ?? {},
    );
    const videoInfo = this.record(item.video ?? item.videoMeta ?? {});
    const music = this.record(item.music ?? item.musicMeta ?? {});

    const externalId = this.string(
      item.id ?? item.awemeId ?? item.aweme_id ?? item.videoId ?? item.video_id,
    );
    if (!externalId) {
      return null;
    }

    const username = this.string(
      author.uniqueId ?? author.userName ?? author.username ?? author.name,
    );
    const creatorExternalId =
      this.string(author.id ?? author.userId) ??
      (username ? `@${username}` : undefined);
    if (!creatorExternalId) {
      return null;
    }

    const caption =
      this.string(item.desc ?? item.caption ?? item.text ?? item.title) ?? "";

    // Some actors (e.g. clockworks/tiktok-scraper) expose counts at the top
    // level instead of inside a nested `stats` object — fall back to those.
    const views = this.bigint(
      stats.playCount ?? stats.play ?? stats.views ?? item.playCount ?? 0,
    );
    const likes = this.bigint(
      stats.diggCount ?? stats.likeCount ?? stats.likes ?? item.diggCount ?? 0,
    );
    const comments = this.bigint(
      stats.commentCount ?? stats.comments ?? item.commentCount ?? 0,
    );
    const shares = this.bigint(
      stats.shareCount ?? stats.shares ?? item.shareCount ?? 0,
    );
    const saves = this.bigintOrNull(
      stats.collectCount ??
        stats.collect ??
        stats.saves ??
        item.collectCount ??
        null,
    );
    const engagementRate =
      this.numberOrNull(stats.engagementRate ?? null) ??
      this.computeEngagement(views, likes, comments, shares, saves);

    const creator: NormalizedTikTokCreator = {
      externalId: creatorExternalId,
      username: username ?? null,
      displayName: this.string(
        author.nickname ?? author.nickName ?? author.displayName ?? author.fullName,
      ),
      profileUrl: this.string(
        author.profileUrl ?? author.authorUrl ?? author.url,
      ),
      avatarUrl: this.string(
        author.avatar ??
          author.avatarUrl ??
          author.profilePicUrl ??
          author.profile_pic_url,
      ),
      followers:
        this.numberOrNull(authorStats.followerCount ?? authorStats.fans ?? author.fans) ??
        this.numberOrNull(author.followers ?? null),
      following:
        this.numberOrNull(authorStats.followingCount ?? author.following) ??
        this.numberOrNull(author.following ?? null),
      totalLikes: this.bigintOrNull(
        authorStats.heartCount ?? authorStats.likes ?? author.heart ?? author.totalLikes ?? null,
      ),
      videoCount:
        this.numberOrNull(authorStats.videoCount ?? author.video ?? author.videoCount) ??
        this.numberOrNull(author.videoCount ?? null),
    };

    const metrics: NormalizedTikTokMetrics = {
      views,
      likes,
      comments,
      shares,
      saves,
      engagementRate,
    };

    const url =
      this.string(item.url ?? item.shareUrl ?? item.webVideoUrl) ??
      (username ? `https://www.tiktok.com/@${username}/video/${externalId}` : null);

    return {
      externalId,
      url,
      thumbnailUrl: this.string(
        item.cover ?? item.thumbnailUrl ?? item.imageUrl ?? videoInfo.cover,
      ),
      caption: caption || null,
      description: this.string(item.description ?? null),
      duration:
        this.numberOrNull(item.duration ?? videoInfo.duration) ??
        this.numberOrNull(item.videoDuration ?? null),
      publishedAt: this.date(
        item.createTime ?? item.create_time ?? item.timestamp ?? item.publishedAt ?? null,
      ),
      musicName: this.string(music.title ?? music.musicName ?? music.name ?? null),
      location: this.string(
        item.location ?? this.record(item.poi ?? {}).name ?? item.locationCreated ?? null,
      ),
      creator,
      metrics,
      hashtags: this.extractHashtags(item, caption),
    };
  }

  private computeEngagement(
    views: bigint,
    likes: bigint,
    comments: bigint,
    shares: bigint,
    saves: bigint | null | undefined,
  ): number | null {
    if (views <= 0n) {
      return null;
    }
    const total = likes + comments + shares + (saves ?? 0n);
    return Number((total * 10000n) / views) / 100;
  }

  private extractHashtags(item: UnknownRecord, caption: string): string[] {
    const tags = new Set<string>();
    const challenges = item.challenges ?? item.textExtra ?? item.hashtags ?? [];
    if (Array.isArray(challenges)) {
      for (const challenge of challenges) {
        const record = this.record(challenge);
        const tag = this.string(
          record.title ?? record.hashtagName ?? record.name ?? record.tag,
        );
        if (tag) {
          tags.add(tag.replace(/^#/, "").trim());
        }
      }
    }
    const regex = /#([\p{L}\p{N}_]+)/gu;
    for (const match of caption.matchAll(regex)) {
      const tag = match[1].trim();
      if (tag) {
        tags.add(tag);
      }
    }
    return [...tags];
  }

  private record(value: unknown): UnknownRecord {
    return value && typeof value === "object" ? (value as UnknownRecord) : {};
  }

  private string(value: unknown): string | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    return String(value);
  }

  private numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private bigint(value: unknown): bigint {
    const n = this.numberOrNull(value);
    return BigInt(Math.max(0, Math.round(n ?? 0)));
  }

  private bigintOrNull(value: unknown): bigint | null {
    const n = this.numberOrNull(value);
    return n === null ? null : BigInt(Math.max(0, Math.round(n)));
  }

  private date(value: unknown): Date | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const n = Number(value);
    // TikTok timestamps are seconds since epoch (< 1e12); other feeds may use ms.
    const ms = Number.isFinite(n) && n > 0 && n < 1e12 ? n * 1000 : n;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
