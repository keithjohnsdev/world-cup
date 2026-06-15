// Generates an original, on-our-own-words recap of a news story via Claude. The
// source text is used only as grounding input (transformative) — the model writes
// its own prose about the facts, which keeps us clear of republishing copyrighted
// article text or photos.

import Anthropic from "@anthropic-ai/sdk";

// Default to Opus 4.8. Override with NEWS_RECAP_MODEL (e.g. claude-haiku-4-5 /
// claude-sonnet-4-6) to trade quality for cost — recaps are cached per story, so
// each one is generated at most once.
const MODEL = process.env.NEWS_RECAP_MODEL || "claude-opus-4-8";

const SYSTEM = `You are a sports writer for a family World Cup 2026 web app.
Write an original, concise recap of the news story described below, in your own words,
based ONLY on the facts present in the provided source text.

Rules:
- Do not copy sentences verbatim from the source — paraphrase entirely.
- Do not invent scores, names, quotes, dates, or any detail not present in the source.
- If the source text is thin, keep the recap short and general rather than inventing specifics.
- Write 2 to 4 short paragraphs of plain Markdown. No headings, no bullet lists, no preamble.
- Start directly with the recap. Output only the recap — no "Here is", no meta-commentary.`;

let _client: Anthropic | undefined;
function client(): Anthropic {
  if (!_client) _client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

export function recapsEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function generateRecap(args: {
  title: string;
  source: string;
  text: string;
}): Promise<string> {
  const body = args.text.trim()
    ? `SOURCE: ${args.source}\nHEADLINE: ${args.title}\n\nARTICLE TEXT:\n${args.text}`
    : `SOURCE: ${args.source}\nHEADLINE: ${args.title}\n\n(No article body was available — write a brief, neutral recap based on the headline alone, without inventing specifics.)`;

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "low" }, // simple grounded summarization
    system: SYSTEM,
    messages: [{ role: "user", content: body }],
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
