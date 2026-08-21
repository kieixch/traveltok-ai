import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TikTokScraper } from "./tiktok-scraper";
import { TikTokMockScraper } from "./tiktok-mock-scraper";
import type { TikTokScraper as TikTokScraperContract } from "./types";

/**
 * Chooses the scraping backend:
 * - `SCRAPING_MODE=mock` (default) → deterministic mock data (no credentials).
 * - `SCRAPING_MODE=apify` (or unset with both credentials present) → real Apify.
 */
@Injectable()
export class TikTokScraperFactory {
  constructor(private readonly config: ConfigService) {}

  create(): TikTokScraperContract {
    const token = this.config.get<string>("APIFY_API_TOKEN");
    const actorId = this.config.get<string>("APIFY_TIKTOK_ACTOR_ID");
    const mode = this.config.get<string>("SCRAPING_MODE");

    if (mode === "apify" && token && actorId) {
      return new TikTokScraper(token, actorId);
    }
    if (!mode && token && actorId) {
      return new TikTokScraper(token, actorId);
    }
    return new TikTokMockScraper();
  }
}
