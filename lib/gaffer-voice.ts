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

export async function voiceGaffer(plain: string): Promise<string> {
  if (!gafferVoiceEnabled()) return plain;
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 200, // one or two short sentences
      output_config: { effort: "low" }, // short, cheap restyle
      system: GAFFER_PERSONA,
      messages: [{ role: "user", content: `PLAIN ANNOUNCEMENT:\n${plain}` }],
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
