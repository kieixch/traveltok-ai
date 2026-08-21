import OpenAI from "openai";
import {
  ContentFormat,
  CtaType,
  ScriptGeneratorInput,
  ScriptSection,
  VideoScript,
} from "./types";
import {
  buildScriptGeneratorUserPrompt,
  SCRIPT_GENERATOR_SYSTEM_PROMPT,
  languageInstruction,
} from "./prompts";
import { validateVideoScript } from "./zod-schemas";
import { hash } from "./content-idea-generator";

export interface ScriptGenerator {
  generate(input: ScriptGeneratorInput): Promise<VideoScript>;
}

const FORMAT_SECTIONS: Record<string, string[]> = {
  VLOG: ["Cold open", "Arrival & first impression", "The highlight", "Wrap up + CTA"],
  TUTORIAL: ["Hook & promise", "Step 1", "Step 2", "Pro tip", "Wrap up + CTA"],
  LICKTILE: ["Hook & the payoff tease", "Item 1", "Item 2", "Item 3", "The sleeper pick", "Wrap up + CTA"],
  REVIEW: ["Hook & verdict tease", "What impressed me", "What disappointed me", "Final verdict", "Wrap up + CTA"],
  POV: ["Setup: context shot", "The moment", "Emotional beat", "Wrap up + CTA"],
  CINEMATIC: ["Establishing wide", "Detail shots", "Golden-hour sequence", "Closing frame + text CTA"],
  STORYTELLING: ["Setup the tension", "The turning point", "The payoff", "Wrap up + CTA"],
  TALKING_HEAD: ["Hook & stake", "Lesson 1", "Lesson 2", "Lesson 3", "Wrap up + CTA"],
  VOICE_OVER: ["Attention grab", "Why now", "The evidence", "Wrap up + CTA"],
  BEFORE_AFTER: ["The before", "The reveal", "The after & verdict", "Wrap up + CTA"],
  OTHER: ["Hook", "Build up", "Payoff", "Wrap up + CTA"],
};

const TONES: Record<string, string> = {
  VLOG: "warm & spontaneous",
  TUTORIAL: "clear & helpful",
  REVIEW: "honest & balanced",
  POV: "immersive & dreamy",
  CINEMATIC: "epic & atmospheric",
  STORYTELLING: "intimate & emotional",
  TALKING_HEAD: "direct & confident",
  VOICE_OVER: "casual & informative",
  BEFORE_AFTER: "playful & surprising",
};

function pickSectionBeats(format: ContentFormat, seed: number): string[] {
  const beats = FORMAT_SECTIONS[format] ?? FORMAT_SECTIONS.OTHER;
  const beatsForScript =
    format === "LISTICLE"
      ? beats.slice(0, 5)
      : format === "VLOG" || format === "REVIEW" || format === "STORYTELLING"
        ? beats.slice(0, 4)
        : beats;
  return beatsForScript.map((beat, index) => beat);
}

/** Deterministic offline script generator used when `AI_MODE=mock`. */
export class MockScriptGenerator implements ScriptGenerator {
  async generate(input: ScriptGeneratorInput): Promise<VideoScript> {
    const seed = hash(input.randomness);
    const beats = pickSectionBeats(input.format, seed);
    const totalDuration = [30, 40, 50, 60][seed % 4];
    const perSection = Math.max(5, Math.floor(totalDuration / beats.length));

    const outline: ScriptSection[] = beats.map((beat, index) => {
      const last = index === beats.length - 1;
      const descriptions: Record<string, string> = {
        "Cold open": `Fast cut of the best ${input.destination ?? "destination"} b-roll with the hook line over it.`,
        "Arrival & first impression": `Handheld shots of arriving — share the raw first impression of ${input.destination ?? "the place"}.`,
        "The highlight": `Centerpiece scene: slow-motion and close-ups around the main attraction.`,
        "Wrap up + CTA": `Settle on a final shot, repeat the value, then ask viewers to ${(input.cta ?? "FOLLOW").toLowerCase().replace(/_/g, " ")}.`,
        "Hook & promise": `Deliver the hook and promise the exact value the viewer will get.`,
        "Step 1": `Open with the first concrete action in ${input.destination ?? "your trip"} — show, don't just tell.`,
        "Step 2": `Build on step one with a practical detail most guides skip.`,
        "Pro tip": `Drop the money-saving or time-saving tip that makes this video worth saving.`,
        "Hook & the payoff tease": `Tease the best item immediately, then promise the full list.`,
        "Item 1": `Quick b-roll beat — one location, one reason, keep it under 10 seconds.`,
        "Item 2": `Second location with a contrasting vibe to keep pace up.`,
        "Item 3": `Third location — add a practical note (cost, timing, booking).`,
        "The sleeper pick": `The item nobody expects — this is your shareable moment.`,
        "Hook & verdict tease": `State the verdict up front, then set up the evidence.`,
        "What impressed me": `First impressions segment — what genuinely exceeded expectations.`,
        "What disappointed me": `The balanced take — what fell short and how to work around it.`,
        "Final verdict": `Recap the verdict with a clear score or recommendation.`,
        "Setup: context shot": `Wide establishing shot that places the viewer in the scene before the action.`,
        "The moment": `The core POV sequence — hold it longer than feels natural for maximum immersion.`,
        "Emotional beat": `A quiet, human detail that connects the viewer emotionally.`,
        "Establishing wide": `Cinematic drone or wide establishing shot that sells the scale.`,
        "Detail shots": `Macro and texture shots cut to the beat of the music.`,
        "Golden-hour sequence": `The money sequence — golden-hour light, slow motion, full screen.`,
        "Closing frame + text CTA": `End on a locked-off frame with a text overlay asking viewers to ${(input.cta ?? "FOLLOW").toLowerCase().replace(/_/g, " ")}.`,
        "Setup the tension": `Introduce the question or tension that the story will resolve.`,
        "The turning point": `The moment everything changes — slow down the edit here.`,
        "The payoff": `The emotional or visual payoff that justifies the story.`,
        "Hook & stake": `Face the camera, deliver the hook, and set the stakes for the audience.`,
        "Lesson 1": `Direct-to-camera lesson with supporting b-roll — one clear takeaway.`,
        "Lesson 2": `Second takeaway with a contrasting example.`,
        "Lesson 3": `Third takeaway that ties the previous two together.`,
        "Attention grab": `Narration opens on the most dramatic visual available.`,
        "Why now": `Explain the timing — why this topic matters right now.`,
        "The evidence": `Back the claim with numbers, footage, or a quick demo.`,
        "The before": `Show the starting point clearly — the viewer needs the contrast later.`,
        "The reveal": `The transition beat — cut hard to the after-state.`,
        "The after & verdict": `Sell the result and tell the viewer what it costs (money or effort).`,
        "Hook": `Open with the hook line over a striking first shot.`,
        "Build up": `Layering shots and context toward the main point.`,
        "Payoff": `Deliver the main point with a strong visual or line.`,
      };
      return {
        section: beat,
        durationSeconds: last
          ? Math.max(perSection, totalDuration - perSection * (beats.length - 1))
          : perSection,
        description:
          descriptions[beat] ??
          `Beat for "${input.ideaTitle}" — keep the ${input.format.toLowerCase()} energy up.`,
      };
    });

    return {
      hook:
        input.hook ??
        `You're not ready for what ${input.destination ?? "this place"} looks like.`,
      outline,
      cta: (input.cta ?? "FOLLOW") as CtaType,
      tone: TONES[input.format] ?? "energetic",
    };
  }
}

/** OpenAI-backed script generator with structured output + validation. */
export class OpenAIScriptGenerator implements ScriptGenerator {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async generate(input: ScriptGeneratorInput): Promise<VideoScript> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: SCRIPT_GENERATOR_SYSTEM_PROMPT + languageInstruction(input.language),
        },
        {
          role: "user",
          content: buildScriptGeneratorUserPrompt({
            ideaTitle: input.ideaTitle,
            hook: input.hook,
            format: input.format,
            topic: input.topic,
            destination: input.destination,
            targetAudience: input.targetAudience,
            cta: input.cta,
            randomness: input.randomness,
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response");
    }

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch (error) {
      throw new Error(`OpenAI returned invalid JSON: ${(error as Error).message}`);
    }

    const parsed = validateVideoScript(raw);
    return {
      hook: parsed.hook,
      outline: parsed.outline,
      cta: parsed.cta,
      tone: parsed.tone,
    };
  }
}
