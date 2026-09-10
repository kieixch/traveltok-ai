import {
  NormalizedTikTokVideo,
  ScrapeInput,
  ScrapeResult,
  TikTokScraper,
} from "./types";

const DESTINATIONS = [
  "Raja Ampat",
  "Komodo Island",
  "Borobudur",
  "Bali Swing",
  "Nusa Penida",
  "Tumpak Sewu",
  "Bromo",
  "Labuan Bajo",
  "Ubud",
  "Wae Rebo",
  "Gili Trawangan",
  "Lake Toba",
  "Banda Neira",
  "Derawan",
  "Sumba",
  "Belitung",
  "Yogyakarta",
  "Pulau Padar",
];

const HASHTAGS = [
  "traveltok",
  "indonesia",
  "travelindonesia",
  "hiddengem",
  "bucketlist",
  "wanderlust",
  "tiktoktravel",
  "bali",
  "rajaampat",
  "exploreindonesia",
  "backpacker",
  "seaside",
];

const MUSIC = [
  "Sunset Serenade",
  "Island Groove",
  "Tropical Vibes",
  "Ocean Breeze",
  "Wanderer Anthem",
  "Chasing Views",
];

export class TikTokMockScraper implements TikTokScraper {
  async scrape(input: ScrapeInput): Promise<ScrapeResult> {
    const seed = this.hashString(input.hashtag ?? input.keyword ?? "traveltok");
    const rng = this.mulberry32(seed);
    const count = Math.min(input.maxResults, 100);

    const items: NormalizedTikTokVideo[] = [];
    for (let i = 0; i < count; i++) {
      const destination =
        DESTINATIONS[Math.floor(rng() * DESTINATIONS.length)];
      const destinationId = Math.floor(rng() * 900000000) + 100000000;
      const videoId = Math.floor(rng() * 9e15) + 1e16;

      const views = BigInt(Math.floor(rng() * 4_900_000) + 10_000);
      const likes = BigInt(Math.round(Number(views) * (0.05 + rng() * 0.2)));
      const comments = BigInt(Math.round(Number(likes) * (0.03 + rng() * 0.1)));
      const shares = BigInt(Math.round(Number(views) * (0.005 + rng() * 0.03)));
      const saves = BigInt(Math.round(Number(views) * (0.02 + rng() * 0.06)));
      const engagement =
        Number((likes + comments + shares + saves) * 10000n / views) / 100;

      const caption = this.caption(rng, destination);
      const hashtags = this.pickHashtags(rng);

      items.push({
        externalId: `mock-video-${videoId}`,
        url: `https://www.tiktok.com/@mock.creator.${destinationId}/video/${videoId}`,
        thumbnailUrl: null,
        caption,
        description: caption,
        duration: 15 + Math.floor(rng() * 60),
        publishedAt: this.pastDate(rng),
        musicName: MUSIC[Math.floor(rng() * MUSIC.length)],
        location: destination,
        creator: {
          externalId: `mock-creator-${destinationId}`,
          username: `mock.creator.${destinationId}`,
          displayName: `Creator of ${destination}`,
          profileUrl: null,
          avatarUrl: null,
          followers: Math.floor(rng() * 5_000_000) + 1_000,
          following: Math.floor(rng() * 2_000),
          totalLikes: BigInt(Math.floor(rng() * 50_000_000) + 100_000),
          videoCount: Math.floor(rng() * 800) + 5,
        },
        metrics: {
          views,
          likes,
          comments,
          shares,
          saves,
          engagementRate: engagement,
        },
        hashtags,
      });
    }

    return { items };
  }

  private caption(rng: () => number, destination: string): string {
    const templates = [
      `${destination} is unreal. The hidden side of travel nobody tells you about.`,
      `POV you finally made it to ${destination}. Worth every flight.`,
      `${destination} in 10 seconds. No filter needed.`,
      `Stop scrolling. ${destination} has to be your next trip.`,
      `Things to know before visiting ${destination}.`,
    ];
    return templates[Math.floor(rng() * templates.length)];
  }

  private pickHashtags(rng: () => number): string[] {
    const count = 2 + Math.floor(rng() * 4);
    const picked = new Set<string>();
    while (picked.size < count) {
      picked.add(HASHTAGS[Math.floor(rng() * HASHTAGS.length)]);
    }
    return [...picked];
  }

  private pastDate(rng: () => number): Date {
    const daysAgo = Math.floor(rng() * 90);
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  }

  private hashString(input: string): number {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
}