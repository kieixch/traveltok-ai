import { AIClassificationError, validateVideoClassification } from "@traveltok/ai";

describe("validateVideoClassification", () => {
  it("passes a well-formed classification through", () => {
    const value = {
      topic: "Bali hidden beaches",
      subTopic: "north Bali",
      destination: "Bali",
      contentFormat: "LISTICLE",
      hookType: "CURIOSITY",
      hookText: "Nobody talks about these beaches",
      ctaType: "SAVE",
      sentiment: "POSITIVE",
      targetAudience: "Travelers",
      estimatedIntent: "planning",
      aiScore: 78,
      summary: "Listicle performing well.",
    };
    expect(validateVideoClassification(value)).toEqual(value);
  });

  it("coerces unknown enum values to safe defaults", () => {
    const result = validateVideoClassification({
      topic: "x",
      contentFormat: "WeirdFormat",
      hookType: "??",
      sentiment: "ANGERY",
    });
    expect(result.contentFormat).toBe("OTHER");
    expect(result.hookType).toBe("OTHER");
    expect(result.sentiment).toBe("NEUTRAL");
  });

  it("turns empty strings into null and fills missing keys", () => {
    const result = validateVideoClassification({
      topic: "  ",
      summary: "",
      destination: "  ",
    });
    expect(result.topic).toBe("Travel");
    expect(result.summary).toBeNull();
    expect(result.destination).toBeNull();
    expect(result.aiScore).toBeNull();
    expect(result.contentFormat).toBe("OTHER");
  });

  it("clamps aiScore to 0-100", () => {
    const result = validateVideoClassification({ topic: "x", aiScore: 400 });
    expect(result.aiScore).toBe(100);
  });

  it("throws AIClassificationError for a non-object", () => {
    expect(() => validateVideoClassification(null)).toThrow(AIClassificationError);
    expect(() => validateVideoClassification("nope")).toThrow(AIClassificationError);
  });
});
