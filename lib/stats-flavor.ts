// Optional LLM "flavor" for the stats tab: turns the deterministic facts into
// punchy, one-line "did you know"-style headlines. Generated in a single batched
// call and cached by value-signature (stats_flavor table) so each distinct fact
// is phrased at most once — mirrors the lazy/cached news recap pattern. Degrades
// silently when ANTHROPIC_API_KEY is unset; the templated `value` is the fallback.

import Anthropic from "@anthropic-ai/sdk";
import { type Stat } from "@/lib/stats";

// Short, cheap output — default to Haiku. Override with STATS_FLAVOR_MODEL.
const MODEL = process.env.STATS_FLAVOR_MODEL || "claude-haiku-4-5";

const SYSTEM = `You are a witty sports-desk editor for a family World Cup 2026 web app.
For each FACT below, write ONE short, punchy headline (max ~12 words) that makes it
feel fun and surprising — like a "did you know" chyron.

Rules:
- Base each headline ONLY on the facts given. Never invent scores, names, seeds, or numbers.
- Keep each to a single line, no period needed, light and playful but not corny.
- Return ONLY a JSON object mapping each fact's "id" to its headline string. No prose, no code fences.`;

let _client: Anthropic | undefined;
function client(): Anthropic {
  if (!_client) _client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

export function flavorEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Batched: returns a map of signature → headline for the given stats. On any
// failure (or when disabled), returns an empty map so callers fall back to value.
export async function generateHeadlines(stats: Stat[]): Promise<Record<string, string>> {
  if (!flavorEnabled() || stats.length === 0) return {};

  const facts = stats.map((s) => ({
    id: s.signature,
    title: s.title,
    fact: s.detail ? `${s.value} (${s.detail})` : s.value,
  }));

  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: `FACTS:\n${JSON.stringify(facts, null, 2)}` }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Strip any stray code fences, then parse the JSON object.
    const json = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(json) as Record<string, unknown>;

    const out: Record<string, string> = {};
    for (const s of stats) {
      const h = parsed[s.signature];
      if (typeof h === "string" && h.trim()) out[s.signature] = h.trim();
    }
    return out;
  } catch (err) {
    console.warn("[stats-flavor] generation failed:", err);
    return {};
  }
}
