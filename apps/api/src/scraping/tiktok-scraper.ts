import { Logger } from "@nestjs/common";
import { ApifyClient } from "apify-client";
import { TikTokDataMapper } from "./data-mapper";
import {
  NormalizedTikTokVideo,
  ScrapeInput,
  ScrapeResult,
  TikTokScraper as TikTokScraperContract,
} from "./types";

/**
 * Real Apify-backed TikTok scraper. Runs the configured actor, downloads the
 * dataset and maps raw items into the internal normalized shape.
 *
 * The actor input varies between actors; the hashtag/keyword are passed as
 * `hashtags` / `searchQueries` which the common TikTok actors accept.
 */
export class TikTokScraper implements TikTokScraperContract {
  private readonly logger = new Logger(TikTokScraper.name);
  private readonly client: ApifyClient;
  private readonly actorId: string;

  constructor(token: string, actorId: string) {
    this.client = new ApifyClient({ token });
    this.actorId = actorId;
  }

  async scrape(input: ScrapeInput): Promise<ScrapeResult> {
    const maxResults = Math.min(input.maxResults ?? 30, 50);
    const actorInput: Record<string, unknown> = {
      maxResults,
      resultsPerPage: Math.min(maxResults, 30),
    };
    if (input.hashtag) {
      actorInput.hashtags = [input.hashtag.replace(/^#/, "")];
    }
    if (input.keyword) {
      actorInput.searchQueries = [input.keyword];
    }

    this.logger.log(
      `Starting Apify run (actor ${this.actorId}, maxResults ${maxResults})`,
    );
    const run = await this.client.actor(this.actorId).call(actorInput, {
      waitSecs: 120,
    });

    this.logger.log(`Apify run ${run.id} status: ${run.status}`);

    const datasetId = run.defaultDatasetId;
    const { items } = await this.client
      .dataset(datasetId)
      .listItems({ limit: maxResults });

    const mapper = new TikTokDataMapper();
    const mapped = items
      .map((item) => mapper.map(item))
      .filter((item): item is NormalizedTikTokVideo => item !== null);

    this.logger.log(
      `Apify run ${run.id} finished: ${mapped.length}/${items.length} usable videos`,
    );
    return { items: mapped, apifyRunId: run.id };
  }
}
