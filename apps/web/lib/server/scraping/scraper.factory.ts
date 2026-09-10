import { TikTokScraper } from "./tiktok-scraper";
import { TikTokMockScraper } from "./tiktok-mock-scraper";
import type { TikTokScraper as TikTokScraperContract } from "./types";

export function createScraper(): TikTokScraperContract {
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env.APIFY_TIKTOK_ACTOR_ID;
  const mode = process.env.SCRAPING_MODE;

  if (mode === "apify" && token && actorId) {
    return new TikTokScraper(token, actorId);
  }
  return new TikTokMockScraper();
}