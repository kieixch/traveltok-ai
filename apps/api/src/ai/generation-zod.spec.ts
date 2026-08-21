import {
  AIClassificationError,
  validateContentIdeaGeneration,
  validateContentPlanDraft,
  validateVideoCaption,
  validateVideoScript,
} from "@traveltok/ai";

describe("validateContentIdeaGeneration", () => {
  it("passes well-formed ideas through", () => {
    const value = {
      title: "5 Bali Spots That Feel Like a Dream",
      topic: "Bali travel",
      destination: "Bali",
      format: "LISTICLE",
      hook: "Number 3 is criminally underrated.",
      hookType: "LIST",
      concept: "A rapid-fire top-5 with quick b-roll cuts.",
      targetAudience: "First-time visitors",
      cta: "SAVE",
      estimatedDuration: 45,
      opportunityScore: 82.5,
      aiReasoning: "Trending hashtag.",
      hashtags: ["bali", "#traveltok", "BALI"],
    };
    const [idea] = validateContentIdeaGeneration([value]);
    expect(idea.title).toBe("5 Bali Spots That Feel Like a Dream");
    expect(idea.format).toBe("LISTICLE");
    expect(idea.hashtags).toEqual(["bali", "traveltok"]);
  });

  it("rejects a non-array root", () => {
    expect(() => validateContentIdeaGeneration({ ideas: [] })).toThrow(AIClassificationError);
    expect(() => validateContentIdeaGeneration("nope")).toThrow(AIClassificationError);
  });

  it("coerces unknown enums and clamps scores", () => {
    const [idea] = validateContentIdeaGeneration([
      { title: "x", format: "Weird", hookType: "??", opportunityScore: 400, hashtags: [] },
    ]);
    expect(idea.format).toBe("OTHER");
    expect(idea.hookType).toBe("OTHER");
    expect(idea.opportunityScore).toBe(100);
  });
});

describe("validateVideoScript", () => {
  it("passes a well-formed script through", () => {
    const script = validateVideoScript({
      hook: "Watch this.",
      outline: [
        { section: "Cold open", durationSeconds: 10, description: "b-roll" },
        { section: "Wrap up", durationSeconds: 20, description: "CTA" },
      ],
      cta: "FOLLOW",
      tone: "energetic",
    });
    expect(script.outline).toHaveLength(2);
    expect(script.cta).toBe("FOLLOW");
  });

  it("falls back when hook is missing", () => {
    const script = validateVideoScript({ outline: [], cta: "FOLLOW", tone: "x" });
    expect(script.hook).toBe("Watch this.");
    expect(script.outline).toEqual([]);
  });
});

describe("validateVideoCaption", () => {
  it("passes a well-formed caption through", () => {
    const caption = validateVideoCaption({
      caption: "Save this for later.",
      hashtags: ["bali", "traveltok"],
      cta: "SAVE",
    });
    expect(caption.hashtags).toEqual(["bali", "traveltok"]);
  });

  it("rejects an empty caption", () => {
    expect(() =>
      validateVideoCaption({ caption: "", hashtags: [], cta: "FOLLOW" }),
    ).toThrow(AIClassificationError);
  });
});

describe("validateContentPlanDraft", () => {
  it("passes a well-formed draft through", () => {
    const draft = validateContentPlanDraft({
      title: "August plan",
      description: "Scheduled posts.",
      items: [
        {
          contentIdeaId: "abc",
          scheduledDate: "2026-08-20",
          title: "Idea A",
        },
      ],
    });
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].scheduledDate).toBe("2026-08-20");
  });

  it("rejects a malformed scheduledDate", () => {
    expect(() =>
      validateContentPlanDraft({
        title: "Plan",
        items: [{ contentIdeaId: "a", scheduledDate: "not-a-date", title: "x" }],
      }),
    ).toThrow(AIClassificationError);
  });

  it("ignores non-array items gracefully", () => {
    const draft = validateContentPlanDraft({ title: "Plan", items: "nope" });
    expect(draft.items).toEqual([]);
  });
});
