import { ApifyClient } from "apify-client";
import { TikTokDataMapper } from "./data-mapper";
import {
  NormalizedTikTokVideo,
  ScrapeInput,
  ScrapeResult,
  TikTokScraper as TikTokScraperContract,
} from "./types";

export class TikTokScraper implements TikTokScraperContract {
  private readonly client: ApifyClient;
  private readonly actorId: string;

  constructor(token: string, actorId: string) {
    this.client = new ApifyClient({ token });
    this.actorId = actorId;
  }

  /**
   * Starts an Apify run without waiting for completion (waitSecs: 0) and
   * registers a webhook so the run result can be ingested serverlessly when
   * the run finishes — replacing the old BullMQ worker.
   */
  async start(input: ScrapeInput, webhookUrl: string): Promise<string> {
    const maxResults = Math.min(input.maxResults ?? 30, 50);
    const actorInput = this.buildActorInput(input, maxResults);

    const run = await this.client.actor(this.actorId).call(actorInput, {
      waitSecs: 0,
      webhooks: [
        {
          eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
          requestUrl: webhookUrl,
        },
      ],
    });
    return run.id;
  }

  /** Downloads the finished dataset of a run and maps it to normalized videos. */
  async fetchResult(runId: string, maxResults = 50): Promise<ScrapeResult> {
    const run = await this.client.run(runId).get();
    if (!run?.defaultDatasetId) {
      return { items: [] };
    }
    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: maxResults });

    const mapper = new TikTokDataMapper();
    const mapped = items
      .map((item) => mapper.map(item))
      .filter((item): item is NormalizedTikTokVideo => item !== null);

    return { items: mapped, apifyRunId: runId };
  }

  async scrape(input: ScrapeInput): Promise<ScrapeResult> {
    const maxResults = Math.min(input.maxResults ?? 30, 50);
    const actorInput = this.buildActorInput(input, maxResults);

    const run = await this.client.actor(this.actorId).call(actorInput, {
      waitSecs: 120,
    });

    const datasetId = run.defaultDatasetId;
    const { items } = await this.client
      .dataset(datasetId)
      .listItems({ limit: maxResults });

    const mapper = new TikTokDataMapper();
    const mapped = items
      .map((item) => mapper.map(item))
      .filter((item): item is NormalizedTikTokVideo => item !== null);

    return { items: mapped, apifyRunId: run.id };
  }

  private buildActorInput(input: ScrapeInput, maxResults: number): Record<string, unknown> {
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
    return actorInput;
  }
}