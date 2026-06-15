// On-demand news search via Claude's server-side web_search tool. Triggered only
// when the local aggregated feed has no stories matching a user's query — Claude
// searches the same trusted outlets we already aggregate (scoped via
// allowed_domains) and returns a small, normalized result set. This is a live
// fetch (no cache), so it costs a model call per miss; keep it off the hot path.

import Anthropic from "@anthropic-ai/sdk";
import { TRUSTED_NEWS_DOMAINS } from "@/lib/news-sources";
import { matchCountries } from "@/lib/news";

const MODEL = process.env.NEWS_SEARCH_MODEL || "claude-opus-4-8";
const MAX_RESULTS = 8;

export interface WebSearchArticle {
  url: string;
  title: string;
  source: string;
  summary: string | null;
  countries: string[]; // World Cup team ids detected in the headline (for flags)
}

let _client: Anthropic | undefined;
function client(): Anthropic {
  if (!_client) _client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

export function webSearchEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM = `You are a search assistant for a family World Cup 2026 web app.
Given a search query, use the web_search tool to find current, real World Cup /
international football news stories that match it, drawn only from the trusted
outlets you are allowed to search.

Then return ONLY a JSON array (no prose, no code fences) of up to ${MAX_RESULTS}
results, most relevant first, each shaped exactly like:
{"url": string, "title": string, "source": string, "summary": string}

Rules:
- "url" must be a real article URL returned by the search — never invent one.
- "source" is the outlet's name (e.g. "BBC Sport", "Reuters").
- "summary" is one neutral sentence in your own words; do not copy article text.
- Only include stories genuinely relevant to the query and to the World Cup /
  international football. If nothing relevant is found, return [].`;

// Pulls the first JSON array out of the model's text, tolerating stray prose or
// code fences the model may add despite instructions.
function extractJsonArray(text: string): unknown {
  const fenced = text.replace(/```(?:json)?/gi, "");
  const start = fenced.indexOf("[");
  const end = fenced.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function searchNewsViaClaude(query: string): Promise<WebSearchArticle[]> {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: { effort: "low" }, // a single grounded search + format
    system: SYSTEM,
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 3,
        allowed_domains: TRUSTED_NEWS_DOMAINS,
      },
    ],
    messages: [{ role: "user", content: `Search query: ${query}` }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const articles: WebSearchArticle[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const { url, title, source, summary } = item as Record<string, unknown>;
    if (typeof url !== "string" || typeof title !== "string") continue;
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    const summaryText = typeof summary === "string" && summary.trim() ? summary : null;
    articles.push({
      url,
      title,
      source: typeof source === "string" && source.trim() ? source : "Web",
      summary: summaryText,
      countries: matchCountries(`${title} ${summaryText ?? ""}`),
    });
    if (articles.length >= MAX_RESULTS) break;
  }
  return articles;
}
