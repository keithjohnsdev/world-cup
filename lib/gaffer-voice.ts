// Re-voices a plain, factually-correct announcement in The Gaffer's persona via
// Claude (see lib/gaffer-persona.ts for the editable instruction document).
// Mirrors the lazy/cached LLM pattern used for news recaps and stats flavor:
// degrades silently to the plain text when ANTHROPIC_API_KEY is unset or a call
// fails, so callers always get usable, factually-correct text.

import Anthropic from "@anthropic-ai/sdk";
import { GAFFER_PERSONA } from "@/lib/gaffer-persona";

// Default to Opus 4.8. Override with GAFFER_MODEL (e.g. claude-haiku-4-5) to
// trade voice quality for cost — each announcement is voiced at most once.
const MODEL = process.env.GAFFER_MODEL || "claude-opus-4-8";

let _client: Anthropic | undefined;
function client(): Anthropic {
  if (!_client) _client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

export function gafferVoiceEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Rotating delivery angles. Opus 4.8 rejects temperature/top_p, so we can't dial
// up sampling randomness — instead we hand each voicing a different lens at random
// so consecutive posts diverge in register even for repetitive event types (every
// "FULL TIME" result, every leaderboard move). Facts are fixed by the persona; the
// angle only steers HOW it's said. One is picked per call; each event is voiced at
// most once (see announce()), so a fresh roll per post is exactly what we want.
const STYLE_ANGLES: string[] = [
  "Call it like a breathless live radio commentator right as the whistle blows.",
  "Deliver it as a grizzled old manager giving a deadpan post-match presser.",
  "Go full tabloid back-page headline — short, punchy, cheeky.",
  "Be the stats-nerd pundit who can't resist working in the numbers.",
  "Lean into pub-landlord banter, ribbing whoever's on the wrong end of it.",
  "Play the wide-eyed superfan who genuinely cannot believe what just happened.",
  "Keep it dry and understated — let the facts land with a raised eyebrow.",
  "Bring big-fight boxing-announcer theatrics and drama.",
  "Talk like a wise old grandpa who's seen a thousand tournaments.",
  "Go breezy and modern, the way you'd hype it in a group chat.",
  "Channel a nature-documentary narrator observing the drama unfold.",
  "Be the hype-man MC working the crowd before they've even sat down.",
];

// Deterministic-per-call variety without a random seed dependency at import time.
function pickAngle(): string {
  const i = Math.floor(Math.random() * STYLE_ANGLES.length);
  return STYLE_ANGLES[i];
}

export async function voiceGaffer(plain: string): Promise<string> {
  if (!gafferVoiceEnabled()) return plain;
  try {
    const angle = pickAngle();
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 200, // one or two short sentences
      output_config: { effort: "low" }, // short, cheap restyle
      system: GAFFER_PERSONA,
      messages: [
        {
          role: "user",
          content: `TODAY'S DELIVERY ANGLE (flavor only — never let it change the facts): ${angle}\n\nPLAIN ANNOUNCEMENT:\n${plain}`,
        },
      ],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || plain;
  } catch (err) {
    console.warn("[gaffer-voice] generation failed:", err);
    return plain;
  }
}
