import {
  ContentIdeaGeneratorInput,
  MockCaptionGenerator,
  MockContentIdeaGenerator,
  MockContentPlanner,
  MockScriptGenerator,
  ScriptGeneratorInput,
  CaptionGeneratorInput,
  ContentPlannerInput,
} from "@traveltok/ai";

const ideaInput: ContentIdeaGeneratorInput = {
  projectName: "Travel Indonesia",
  niche: "Indonesia travel",
  topHashtags: ["traveltok", "bali", "budgettravel"],
  topDestinations: ["bali", "labuan bajo", "yogyakarta"],
  formatMix: ["VLOG", "LISTICLE", "TUTORIAL", "POV"],
  count: 5,
  randomness: "project-1",
};

describe("MockContentIdeaGenerator", () => {
  it("generates the requested number of ideas", async () => {
    const ideas = await new MockContentIdeaGenerator().generate(ideaInput);
    expect(ideas).toHaveLength(5);
  });

  it("is deterministic for the same randomness", async () => {
    const generator = new MockContentIdeaGenerator();
    const a = await generator.generate(ideaInput);
    const b = await generator.generate(ideaInput);
    expect(a.map((idea) => idea.title)).toEqual(b.map((idea) => idea.title));
  });

  it("produces valid, non-empty drafts with bounded scores", async () => {
    const ideas = await new MockContentIdeaGenerator().generate(ideaInput);
    for (const idea of ideas) {
      expect(idea.title.length).toBeGreaterThan(0);
      expect(idea.format).toMatch(/^(VLOG|LISTICLE|TUTORIAL|POV|REVIEW|STORYTELLING|CINEMATIC|TALKING_HEAD|VOICE_OVER|BEFORE_AFTER|OTHER)$/);
      expect(idea.opportunityScore).toBeGreaterThanOrEqual(45);
      expect(idea.opportunityScore).toBeLessThanOrEqual(95);
      expect(idea.hashtags.length).toBeGreaterThan(0);
    }
  });

  it("respects an explicit format filter", async () => {
    const ideas = await new MockContentIdeaGenerator().generate({
      ...ideaInput,
      formatMix: ["TUTORIAL"],
      count: 3,
    });
    expect(ideas).toHaveLength(3);
    for (const idea of ideas) {
      expect(idea.format).toBe("TUTORIAL");
    }
  });
});

const scriptInput: ScriptGeneratorInput = {
  ideaTitle: "5 Bali Spots That Feel Like a Dream",
  hook: "Number 3 is criminally underrated in Bali.",
  format: "LISTICLE",
  topic: "Bali travel",
  destination: "Bali",
  targetAudience: "First-time visitors",
  cta: "SAVE",
  randomness: "idea-1",
};

describe("MockScriptGenerator", () => {
  it("returns a structured script", async () => {
    const script = await new MockScriptGenerator().generate(scriptInput);
    expect(script.hook.length).toBeGreaterThan(0);
    expect(script.outline.length).toBeGreaterThanOrEqual(3);
    expect(script.cta).toBe("SAVE");
    expect(script.tone.length).toBeGreaterThan(0);
  });

  it("keeps outline durations consistent and within 20-60s", async () => {
    const script = await new MockScriptGenerator().generate(scriptInput);
    const total = script.outline.reduce((sum, scene) => sum + scene.durationSeconds, 0);
    expect(total).toBeGreaterThanOrEqual(20);
    expect(total).toBeLessThanOrEqual(60);
    for (const scene of script.outline) {
      expect(scene.durationSeconds).toBeGreaterThan(0);
      expect(scene.description.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for the same randomness", async () => {
    const generator = new MockScriptGenerator();
    const a = await generator.generate(scriptInput);
    const b = await generator.generate(scriptInput);
    expect(a).toEqual(b);
  });
});

const captionInput: CaptionGeneratorInput = {
  ideaTitle: "5 Bali Spots That Feel Like a Dream",
  topic: "Bali travel",
  destination: "Bali",
  format: "LISTICLE",
  hook: "Number 3 is criminally underrated in Bali.",
  cta: "SAVE",
  hashtags: ["bali", "traveltok"],
  randomness: "idea-1",
};

describe("MockCaptionGenerator", () => {
  it("returns a caption with hashtags and a CTA", async () => {
    const caption = await new MockCaptionGenerator().generate(captionInput);
    expect(caption.caption.length).toBeGreaterThan(0);
    expect(caption.hashtags.length).toBeGreaterThan(0);
    expect(caption.cta).toBe("SAVE");
  });

  it("strips '#' from hashtags and dedupes", async () => {
    const caption = await new MockCaptionGenerator().generate({
      ...captionInput,
      hashtags: ["#Bali", "bali", "TRAVELTOK"],
    });
    const normalized = caption.hashtags.map((tag) => tag.toLowerCase());
    expect(new Set(normalized).size).toBe(normalized.length);
    expect(normalized.some((tag) => tag.includes("#"))).toBe(false);
  });

  it("is deterministic for the same randomness", async () => {
    const generator = new MockCaptionGenerator();
    const a = await generator.generate(captionInput);
    const b = await generator.generate(captionInput);
    expect(a).toEqual(b);
  });
});

const plannerInput: ContentPlannerInput = {
  projectName: "Travel Indonesia",
  niche: "Indonesia travel",
  startDate: new Date("2026-08-17T00:00:00.000Z"),
  endDate: new Date("2026-08-30T00:00:00.000Z"),
  postsPerWeek: 3,
  ideas: [
    { id: "a", title: "Idea A", format: "VLOG", opportunityScore: 90 },
    { id: "b", title: "Idea B", format: "LISTICLE", opportunityScore: 70 },
    { id: "c", title: "Idea C", format: "TUTORIAL", opportunityScore: 55 },
    { id: "d", title: "Idea D", format: "POV", opportunityScore: 40 },
    { id: "e", title: "Idea E", format: "REVIEW", opportunityScore: 30 },
    { id: "f", title: "Idea F", format: "VLOG", opportunityScore: 20 },
  ],
  randomness: "project-1:range:3",
};

describe("MockContentPlanner", () => {
  it("schedules posts within the date range and prioritizes top ideas", async () => {
    const draft = await new MockContentPlanner().generate(plannerInput);
    const start = plannerInput.startDate.getTime();
    const end = plannerInput.endDate.getTime();
    expect(draft.items.length).toBeGreaterThan(0);
    expect(draft.items[0].contentIdeaId).toBe("a");
    for (const item of draft.items) {
      const date = new Date(`${item.scheduledDate}T00:00:00.000Z`).getTime();
      expect(date).toBeGreaterThanOrEqual(start);
      expect(date).toBeLessThanOrEqual(end);
      expect(item.title.length).toBeGreaterThan(0);
    }
  });

  it("uses each idea at most once", async () => {
    const draft = await new MockContentPlanner().generate(plannerInput);
    const ids = draft.items.map((item) => item.contentIdeaId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deterministic for the same randomness", async () => {
    const planner = new MockContentPlanner();
    const a = await planner.generate(plannerInput);
    const b = await planner.generate(plannerInput);
    expect(a).toEqual(b);
  });

  it("caps slots by the idea pool size", async () => {
    const draft = await new MockContentPlanner().generate({
      ...plannerInput,
      ideas: plannerInput.ideas.slice(0, 2),
      postsPerWeek: 7,
    });
    expect(draft.items.length).toBeLessThanOrEqual(2);
  });
});
