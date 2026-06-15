// News aggregation core: fetch reputable RSS/Atom feeds, normalize items, tag
// them with the World Cup countries they mention, and cluster near-duplicate
// stories so cross-outlet coverage becomes a "traction" signal. No external
// dependency — a small hand-rolled parser keeps the lean dependency list intact.

import { TEAMS } from "@/lib/data";
import { NEWS_SOURCES, type NewsSource } from "@/lib/news-sources";

export interface RawArticle {
  url: string;
  title: string;
  source: string;
  summary: string;
  imageUrl: string | null;
  publishedAt: Date;
}

export interface ScoredArticle extends RawArticle {
  countries: string[]; // matched team ids, e.g. ["USA","MEX"]
  clusterId: string;
  sourceCount: number; // distinct outlets covering the same story
  traction: number;
}

const FEED_TIMEOUT_MS = 6000;
const RECENCY_WINDOW_HOURS = 48; // only cluster/rank stories from the last ~2 days
const JACCARD_THRESHOLD = 0.5; // title-token overlap to treat two stories as one

// ── Text helpers ───────────────────────────────────────────────────────────────

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ");
}

function clean(s: string): string {
  return decodeEntities(stripHtml(stripCdata(s))).replace(/\s+/g, " ").trim();
}

// ascii-lowercase, diacritics removed, smart quotes normalized — so "Türkiye"
// matches "turkiye" and "Côte d'Ivoire" matches "cote d'ivoire".
function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’′`]/g, "'")
    .toLowerCase();
}

// ── XML extraction ──────────────────────────────────────────────────────────────

function firstTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : null;
}

function firstAttr(block: string, tag: string, attr: string): string | null {
  // matches e.g. <media:content url="..."> (self-closing or not)
  const m = block.match(new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? m[1] : null;
}

function extractLink(block: string): string | null {
  // RSS: <link>https://...</link>
  const rss = firstTag(block, "link");
  if (rss && rss.trim().startsWith("http")) return rss.trim();
  // Atom: <link href="..." rel="alternate"/> — prefer alternate, else first href
  const links = [...block.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const alternate = links.find((l) => /rel\s*=\s*"alternate"/i.test(l)) ?? links[0];
  if (alternate) {
    const href = alternate.match(/href\s*=\s*"([^"]*)"/i);
    if (href) return href[1];
  }
  return null;
}

function extractImage(block: string): string | null {
  return (
    firstAttr(block, "media:content", "url") ??
    firstAttr(block, "media:thumbnail", "url") ??
    firstAttr(block, "enclosure", "url") ??
    (block.match(/<img\b[^>]*\bsrc\s*=\s*"([^"]*)"/i)?.[1] ?? null)
  );
}

function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    // strip tracking params so syndicated copies dedupe
    [...u.searchParams.keys()]
      .filter((k) => /^utm_|^ito$|^ns_|^cmp/i.test(k))
      .forEach((k) => u.searchParams.delete(k));
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

function parseFeed(xml: string, sourceName: string): RawArticle[] {
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ].map((m) => m[0]);

  const out: RawArticle[] = [];
  for (const block of blocks) {
    const link = extractLink(block);
    const titleRaw = firstTag(block, "title");
    if (!link || !titleRaw) continue;

    const dateRaw =
      firstTag(block, "pubDate") ??
      firstTag(block, "published") ??
      firstTag(block, "updated") ??
      firstTag(block, "dc:date");
    const parsed = dateRaw ? new Date(clean(dateRaw)) : new Date();
    const publishedAt = isNaN(parsed.getTime()) ? new Date() : parsed;

    const summaryRaw =
      firstTag(block, "description") ??
      firstTag(block, "summary") ??
      firstTag(block, "content") ??
      "";

    out.push({
      url: canonicalizeUrl(clean(link)),
      title: clean(titleRaw),
      source: sourceName,
      summary: clean(summaryRaw).slice(0, 300),
      imageUrl: extractImage(block),
      publishedAt,
    });
  }
  return out;
}

// ── Country tagging ─────────────────────────────────────────────────────────────

// Extra aliases beyond the canonical team name (lowercased; diacritics handled by
// normalizeText). Keyed by team id. Avoid short ambiguous tokens like "us".
const COUNTRY_ALIASES: Record<string, string[]> = {
  USA: ["united states", "usmnt", "team usa", "usa"],
  KOR: ["south korea", "korea"],
  PRK: ["north korea"],
  TUR: ["turkey", "turkiye"],
  CZE: ["czechia", "czech republic"],
  CIV: ["ivory coast", "cote d'ivoire"],
  NED: ["netherlands", "holland", "dutch"],
  BIH: ["bosnia", "bosnia and herzegovina"],
  COD: ["congo dr", "dr congo", "democratic republic of congo"],
  CPV: ["cape verde"],
  KSA: ["saudi arabia", "saudi"],
  RSA: ["south africa"],
  NZL: ["new zealand"],
  CUW: ["curacao"],
  CRO: ["croatia"],
};

interface CountryMatcher {
  teamId: string;
  re: RegExp;
}

const COUNTRY_MATCHERS: CountryMatcher[] = TEAMS.flatMap((team) => {
  const names = new Set<string>([team.name, ...(COUNTRY_ALIASES[team.id] ?? [])]);
  return [...names].map((name) => {
    const norm = normalizeText(name).replace(/[.&]/g, "").trim();
    const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // surrounded by non-letters (or string edges) so "korea" can't match inside a word
    return { teamId: team.id, re: new RegExp(`(?<![a-z])${escaped}(?![a-z])`) };
  });
});

const WORLD_CUP_RE = /(world cup|fifa)/;

export function matchCountries(text: string): string[] {
  const norm = normalizeText(text);
  const ids = new Set<string>();
  for (const { teamId, re } of COUNTRY_MATCHERS) {
    if (re.test(norm)) ids.add(teamId);
  }
  return [...ids];
}

// A story is World Cup-relevant if it names a participating nation or mentions
// the World Cup / FIFA — this filters out generic club football from the feeds.
function isRelevant(text: string, countries: string[]): boolean {
  return countries.length > 0 || WORLD_CUP_RE.test(normalizeText(text));
}

// ── Clustering & scoring ────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "of", "to", "in", "on", "at", "by",
  "with", "from", "as", "is", "are", "was", "were", "be", "vs", "v", "after",
  "into", "out", "over", "his", "her", "their", "it", "its", "new", "world", "cup",
]);

function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeText(title)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function recencyWeight(publishedAt: Date): number {
  const ageHours = (Date.now() - publishedAt.getTime()) / 3_600_000;
  return Math.exp(-Math.max(0, ageHours) / 18);
}

interface Cluster {
  id: string;
  tokens: Set<string>;
  sources: Set<string>;
  members: RawArticle[];
}

/**
 * Dedupe by URL, drop stories outside the recency window or not World Cup-related,
 * greedily cluster by title-token similarity, and assign each a traction score
 * (cross-outlet coverage × recency). Returns one scored row per surviving article.
 */
export function clusterAndScore(articles: RawArticle[]): ScoredArticle[] {
  const cutoff = Date.now() - RECENCY_WINDOW_HOURS * 3_600_000;

  // dedupe by canonical URL (keep the earliest publish time we saw)
  const byUrl = new Map<string, RawArticle>();
  for (const a of articles) {
    const existing = byUrl.get(a.url);
    if (!existing || a.publishedAt < existing.publishedAt) byUrl.set(a.url, a);
  }

  const candidates = [...byUrl.values()]
    .filter((a) => a.publishedAt.getTime() >= cutoff)
    .map((a) => ({ a, countries: matchCountries(`${a.title} ${a.summary}`) }))
    .filter(({ a, countries }) => isRelevant(`${a.title} ${a.summary}`, countries))
    .sort((x, y) => y.a.publishedAt.getTime() - x.a.publishedAt.getTime());

  const clusters: Cluster[] = [];
  const countriesByUrl = new Map<string, string[]>();

  for (const { a, countries } of candidates) {
    countriesByUrl.set(a.url, countries);
    const tokens = titleTokens(a.title);

    let best: Cluster | null = null;
    let bestScore = 0;
    for (const c of clusters) {
      const score = jaccard(tokens, c.tokens);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    if (best && bestScore >= JACCARD_THRESHOLD) {
      best.members.push(a);
      best.sources.add(a.source);
      for (const t of tokens) best.tokens.add(t);
    } else {
      clusters.push({
        id: `c${clusters.length}`,
        tokens,
        sources: new Set([a.source]),
        members: [a],
      });
    }
  }

  const scored: ScoredArticle[] = [];
  for (const c of clusters) {
    const sourceCount = c.sources.size;
    for (const a of c.members) {
      scored.push({
        ...a,
        countries: countriesByUrl.get(a.url) ?? [],
        clusterId: c.id,
        sourceCount,
        traction: sourceCount * recencyWeight(a.publishedAt),
      });
    }
  }
  return scored;
}

// ── Fetching ────────────────────────────────────────────────────────────────────

async function fetchFeed(source: NewsSource): Promise<RawArticle[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; JohnsiesWorldCup/1.0; +https://github.com/)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseFeed(await res.text(), source.name);
  } finally {
    clearTimeout(timer);
  }
}

export interface FetchResult {
  articles: RawArticle[];
  errors: { source: string; error: string }[];
}

export async function fetchAllNews(): Promise<FetchResult> {
  const settled = await Promise.allSettled(NEWS_SOURCES.map(fetchFeed));
  const articles: RawArticle[] = [];
  const errors: { source: string; error: string }[] = [];

  settled.forEach((r, i) => {
    if (r.status === "fulfilled") articles.push(...r.value);
    else errors.push({ source: NEWS_SOURCES[i].name, error: String(r.reason) });
  });

  return { articles, errors };
}
