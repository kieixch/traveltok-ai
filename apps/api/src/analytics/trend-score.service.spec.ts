import { computeTrendScores } from "./trend-score.service";

const WEIGHTS = {
  growth: 0.3,
  engagement: 0.25,
  frequency: 0.2,
  recency: 0.15,
  contentGap: 0.1,
};

describe("computeTrendScores", () => {
  it("returns zeros for trend/opportunity when nothing matches", () => {
    const result = computeTrendScores(
      {
        matchingVideos: 0,
        totalVideos: 120,
        matchingCreators: 0,
        totalCreators: 25,
        avgEngagementRate: null,
        recentCount: 0,
        earlierCount: 0,
      },
      WEIGHTS,
    );
    expect(result.growthRate).toBe(0);
    expect(result.trendScore).toBe(0);
    expect(result.opportunityScore).toBe(0);
    expect(result.contentGapScore).toBe(100);
    expect(result.engagementScore).toBe(0);
    expect(result.frequencyScore).toBe(0);
  });

  it("scores a rising, well-covered trend highly", () => {
    const result = computeTrendScores(
      {
        matchingVideos: 24,
        totalVideos: 120,
        matchingCreators: 5,
        totalCreators: 25,
        avgEngagementRate: 6,
        recentCount: 18,
        earlierCount: 6,
      },
      WEIGHTS,
    );
    // growth 200% -> 100; engagement 120 -> clamped 100;
    // frequency 20% -> 40; recency 75%; gap 80%.
    expect(result.growthRate).toBe(200);
    expect(result.engagementScore).toBe(100);
    expect(result.frequencyScore).toBe(40);
    expect(result.recencyScore).toBe(75);
    expect(result.contentGapScore).toBe(80);
    const expected =
      0.3 * 100 + 0.25 * 100 + 0.2 * 40 + 0.15 * 75 + 0.1 * 80;
    expect(result.trendScore).toBe(Math.round(expected * 10) / 10);
    expect(result.opportunityScore).toBe(
      Math.round((expected * 0.85 + 80 * 0.15) * 10) / 10,
    );
  });

  it("scores a declining topic negatively on growth", () => {
    const result = computeTrendScores(
      {
        matchingVideos: 30,
        totalVideos: 120,
        matchingCreators: 10,
        totalCreators: 25,
        avgEngagementRate: 2,
        recentCount: 10,
        earlierCount: 20,
      },
      WEIGHTS,
    );
    expect(result.growthRate).toBe(-50);
    expect(result.engagementScore).toBe(40);
    // frequency 25% -> 50; gap 60%.
    const expected =
      0.3 * 0 + 0.25 * 40 + 0.2 * 50 + 0.15 * (10 / 30) * 100 + 0.1 * 60;
    expect(result.trendScore).toBe(Math.round(expected * 10) / 10);
  });

  it("caps components at 100", () => {
    const result = computeTrendScores(
      {
        matchingVideos: 200,
        totalVideos: 100,
        matchingCreators: 25,
        totalCreators: 25,
        avgEngagementRate: 25,
        recentCount: 200,
        earlierCount: 0,
      },
      WEIGHTS,
    );
    expect(result.engagementScore).toBe(100);
    expect(result.frequencyScore).toBe(100);
    expect(result.recencyScore).toBe(100);
    expect(result.contentGapScore).toBe(0);
  });
});
