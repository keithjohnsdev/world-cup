// Free, keyless, fast news fallback via Google News RSS search. Indexes the whole
// web (not just our curated feeds), so it almost always returns something for any
// country or query — and costs nothing. Used as the first live fallback when our
// aggregated feed has no match; Claude web search is reserved for the rare miss.

import type { WebSearchArticle } from "@/lib/news-search";

const TIMEOUT_MS = 6000;
const MAX_RESULTS = 10;

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function clean(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : null;
}

// Public search URL (for a "browse more" link), distinct from the RSS endpoint.
export function googleNewsSearchUrl(query: string): string {
  return `https://news.google.com/search?q=${encodeURIComponent(query)}`;
}

export async function fetchGoogleNews(query: string): Promise<WebSearchArticle[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let xml: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; JohnsiesWorldCup/1.0; +https://github.com/)" },
    });
    if (!res.ok) return [];
    xml = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const seen = new Set<string>();
  const out: WebSearchArticle[] = [];

  for (const item of items) {
    const link = tag(item, "link");
    const titleRaw = tag(item, "title");
    if (!link || !titleRaw) continue;

    const href = clean(link);
    if (!/^https?:\/\//i.test(href) || seen.has(href)) continue;
    seen.add(href);

    // <source url="...">Outlet</source>; Google also appends " - Outlet" to titles.
    const source = tag(item, "source") ? clean(tag(item, "source")!) : "";
    let title = clean(titleRaw);
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(source.length + 3));
    }

    out.push({
      url: href,
      title,
      source: source || "Google News",
      summary: null, // Google's RSS "description" is a link blob, not a usable summary
    });
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}
