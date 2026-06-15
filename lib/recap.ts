// Generates an original, on-our-own-words recap of a news story via Claude. The
// source text is used only as grounding input (transformative) — the model writes
// its own prose about the facts, which keeps us clear of republishing copyrighted
// article text or photos.

import Anthropic from "@anthropic-ai/sdk";

// Default to Opus 4.8. Override with NEWS_RECAP_MODEL (e.g. claude-haiku-4-5 /
// claude-sonnet-4-6) to trade quality for cost — recaps are cached per story, so
// each is generated at most once.
const MODEL = process.env.NEWS_RECAP_MODEL || "claude-opus-4-8";

const SYSTEM = `You are a sports writer for a family World Cup 2026 web app. Write an engaging,
detailed recap of the news story below in your own words — cover the key facts, the
relevant background and context, and what it means going forward, so a reader gets the
full picture without leaving for the original article.

Base everything ONLY on the facts present in the provided source text.
- Paraphrase entirely — never copy sentences verbatim from the source.
- Never invent scores, names, quotes, dates, or any detail not present in the source.
- Be thorough and detailed: aim for roughly 6 to 10 paragraphs that tell the full story — what happened, the key moments and specifics, the background and context, any reactions or quotes present in the source, and what it means going forward. Use everything relevant in the source and expand on it rather than just summarizing.
- If the source text is genuinely thin, write what you legitimately can without padding or inventing — never manufacture detail just to reach a length.
- Plain Markdown only. No headings, no bullet lists, no preamble.
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
    : `SOURCE: ${args.source}\nHEADLINE: ${args.title}\n\n(No article body was available — write a brief recap based on the headline alone, without inventing specifics.)`;

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 4096, // room for the long, detailed recaps
    output_config: { effort: "medium" }, // a bit more depth for the longer recaps
    system: SYSTEM,
    messages: [{ role: "user", content: body }],
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
