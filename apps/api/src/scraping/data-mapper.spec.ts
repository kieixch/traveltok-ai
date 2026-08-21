import { TikTokDataMapper } from "./data-mapper";

describe("TikTokDataMapper", () => {
  const mapper = new TikTokDataMapper();

  it("returns null for non-object input", () => {
    expect(mapper.map(null)).toBeNull();
    expect(mapper.map("video")).toBeNull();
  });

  it("returns null when no external id can be derived", () => {
    expect(mapper.map({ desc: "no id here" })).toBeNull();
  });

  it("returns null when the author has no stable identity", () => {
    expect(
      mapper.map({ id: "123", author: { nickname: "Anonymous" } }),
    ).toBeNull();
  });

  it("maps a typical Apify item (clockworks shape)", () => {
    const raw = {
      id: "7111111111111111111",
      desc: "Hidden gem in Raja Ampat #traveltok #indonesia",
      createTime: 1700000000,
      duration: 34,
      stats: {
        playCount: 1250000,
        diggCount: 95000,
        commentCount: 4200,
        shareCount: 8100,
        collectCount: 15400,
      },
      author: {
        id: "author-1",
        uniqueId: "explore.id",
        nickname: "Explore Indonesia",
        avatar: "https://p16-va.tiktokcdn.com/avatar.jpg",
      },
      authorStats: {
        followerCount: 240000,
        followingCount: 310,
        heartCount: 12000000,
        videoCount: 512,
      },
      challenges: [
        { title: "traveltok" },
        { title: "indonesia" },
      ],
      music: { title: "original sound" },
    };

    const video = mapper.map(raw);

    expect(video).not.toBeNull();
    expect(video!.externalId).toBe("7111111111111111111");
    expect(video!.creator).toMatchObject({
      externalId: "author-1",
      username: "explore.id",
      displayName: "Explore Indonesia",
      followers: 240000,
    });
    expect(video!.creator.totalLikes).toBe(12000000n);
    expect(video!.metrics).toEqual({
      views: 1250000n,
      likes: 95000n,
      comments: 4200n,
      shares: 8100n,
      saves: 15400n,
      engagementRate: Number((((95000n + 4200n + 8100n + 15400n) * 10000n) / 1250000n)) / 100,
    });
    expect(video!.hashtags).toEqual(["traveltok", "indonesia"]);
    expect(video!.publishedAt).toEqual(new Date(1700000000 * 1000));
    expect(video!.duration).toBe(34);
    expect(video!.musicName).toBe("original sound");
    expect(video!.url).toBe("https://www.tiktok.com/@explore.id/video/7111111111111111111");
  });

  it("parses hashtags from the caption when challenges are absent", () => {
    const video = mapper.map({
      id: "v2",
      desc: "Sunset in Bali #bali #sunset #travel",
      author: { id: "a2", uniqueId: "user2" },
    });
    expect(video!.hashtags).toEqual(["bali", "sunset", "travel"]);
  });

  it("accepts seconds timestamps and computes engagement when missing", () => {
    const video = mapper.map({
      id: "v3",
      desc: "test",
      createTime: 1690000000,
      stats: { playCount: 100, diggCount: 5, commentCount: 1, shareCount: 2 },
      author: { id: "a3", uniqueId: "user3" },
    });
    expect(video!.publishedAt).toEqual(new Date(1690000000 * 1000));
    expect(video!.metrics.engagementRate).toBe(8);
  });

  it("handles alternate key shapes (authorMeta / stats.author)", () => {
    const video = mapper.map({
      id: "v4",
      video_id: "v4",
      text: "Amazing place",
      authorMeta: {
        id: "a4",
        name: "muser",
        nickName: "Musical User",
        avatar: "https://example.com/a.jpg",
      },
      stats: {
        author: { fans: 1500, heart: 9000, video: 42, following: 20 },
      },
    });
    expect(video!.creator.externalId).toBe("a4");
    expect(video!.creator.username).toBe("muser");
    expect(video!.creator.displayName).toBe("Musical User");
    expect(video!.creator.followers).toBe(1500);
  });

  it("skips malformed hashtag entries", () => {
    const video = mapper.map({
      id: "v5",
      desc: "clean caption",
      challenges: [{ title: "valid" }, {}, { title: "" }],
      author: { id: "a5", uniqueId: "user5" },
    });
    expect(video!.hashtags).toEqual(["valid"]);
  });
});
