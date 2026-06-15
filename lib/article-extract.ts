// Best-effort readable-text extraction from a source article URL. The output is
// used ONLY as grounding input for the Claude recap (transformative use) — it is
// never re-served verbatim. Hand-rolled and dependency-free; it doesn't need to
// be perfect, just clean enough for the model to summarize accurately.

const FETCH_TIMEOUT_MS = 8000;
const MAX_CHARS = 8000; // bound token/cost for the recap call

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

// Drop non-content elements whose text would only add noise.
function stripChrome(html: string): string {
  return html.replace(
    /<(script|style|nav|header|footer|aside|form|figure|figcaption|noscript|svg)\b[\s\S]*?<\/\1>/gi,
    " ",
  );
}

function pickMainRegion(html: string): string {
  const article = html.match(/<article\b[\s\S]*?<\/article>/i);
  if (article) return article[0];
  const main = html.match(/<main\b[\s\S]*?<\/main>/i);
  if (main) return main[0];
  const body = html.match(/<body\b[\s\S]*?<\/body>/i);
  return body ? body[0] : html;
}

// Pull paragraph text; fall back to all stripped text if a page doesn't use <p>.
function extractParagraphs(region: string): string {
  const paras = [...region.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 40); // skip captions/bylines/boilerplate

  if (paras.join(" ").length >= 200) return paras.join("\n\n");
  return decodeEntities(region.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Fetch the article and return cleaned body text (empty string on any failure —
 * the caller falls back to the RSS title/summary it already has).
 */
export async function fetchArticleText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; JohnsiesWorldCup/1.0; +https://github.com/)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const text = extractParagraphs(pickMainRegion(stripChrome(html)));
    return text.slice(0, MAX_CHARS);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}
