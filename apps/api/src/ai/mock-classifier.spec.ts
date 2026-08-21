import { MockVideoClassifier } from "@traveltok/ai";

describe("MockVideoClassifier", () => {
  const classifier = new MockVideoClassifier();

  it("is deterministic for identical input", async () => {
    const input = { caption: "Hidden gem in Bali #bali #travel", hashtags: ["bali", "travel"] };
    const a = await classifier.classify(input);
    const b = await classifier.classify(input);
    expect(a).toEqual(b);
  });

  it("detects destination, positive sentiment and SAVE cta", async () => {
    const result = await classifier.classify({
      caption: "Save this! Hidden gem in Bali #bali #travel",
      hashtags: ["bali", "travel"],
    });
    expect(result.destination).toBe("bali");
    expect(result.topic).toBe("Bali travel");
    expect(result.ctaType).toBe("SAVE");
    expect(result.sentiment).toBe("POSITIVE");
    expect(result.hookType).toBe("CURIOSITY");
  });

  it("classifies a listicle about Yogyakarta", async () => {
    const result = await classifier.classify({
      caption: "Top 5 things to do in Yogyakarta",
      hashtags: [],
    });
    expect(result.destination).toBe("yogyakarta");
    expect(result.contentFormat).toBe("LISTICLE");
    expect(result.hookType).toBe("LIST");
    expect(result.estimatedIntent).toBe("planning");
  });

  it("classifies a tutorial with a problem hook", async () => {
    const result = await classifier.classify({
      caption: "How to budget a trip to Raja Ampat",
      hashtags: [],
    });
    expect(result.destination).toBe("raja ampat");
    expect(result.contentFormat).toBe("TUTORIAL");
    expect(result.hookType).toBe("PROBLEM");
  });

  it("detects negative sentiment", async () => {
    const result = await classifier.classify({
      caption: "This place is overrated and crowded, avoid it",
      hashtags: [],
    });
    expect(result.sentiment).toBe("NEGATIVE");
  });

  it("maps engagement rate into a bounded aiScore", async () => {
    const mid = await classifier.classify({ caption: "test", hashtags: [], engagementRate: 6 });
    expect(mid.aiScore).toBe(48);

    const max = await classifier.classify({ caption: "test", hashtags: [], engagementRate: 25 });
    expect(max.aiScore).toBe(95);

    const min = await classifier.classify({ caption: "test", hashtags: [], engagementRate: 0 });
    expect(min.aiScore).toBe(20);
  });

  it("falls back to OTHER / NEUTRAL / Travel with no signal", async () => {
    const result = await classifier.classify({ caption: "zebra 123", hashtags: [] });
    expect(result.contentFormat).toBe("OTHER");
    expect(result.hookType).toBe("OTHER");
    expect(result.sentiment).toBe("NEUTRAL");
    expect(result.topic).toBe("Travel");
    expect(result.destination).toBeNull();
  });

  it("extracts the hook text from the first sentence", async () => {
    const result = await classifier.classify({
      caption: "Trust me. This beach is unreal.",
      hashtags: [],
    });
    expect(result.hookText).toBe("Trust me");
  });
});
