// On-demand live fallback for the News tab, used only when /api/news has no
// aggregated match for a query/country. Cheapest path first:
//   1. Google News RSS — free, keyless, fast, indexes the whole web.
//   2. Claude web search — richer (scoped to trusted outlets) but billed; only
//      runs if Google found nothing, so it's effectively a rare backstop.
// No auth — read-only public content, like the other news routes.

import { NextRequest, NextResponse } from "next/server";
import { searchNewsViaClaude, webSearchEnabled } from "@/lib/news-search";
import { fetchGoogleNews } from "@/lib/google-news";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // the Claude backstop can take a few seconds

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ articles: [], web: true });

  // 1. Free/fast: Google News RSS. Covers nearly any country or string.
  try {
    const google = await fetchGoogleNews(q);
    if (google.length > 0) {
      return NextResponse.json({ articles: google, web: true, via: "google" });
    }
  } catch (err) {
    console.error("[news/search] google news failed:", err);
  }

  // 2. Backstop: Claude web search (only when Google came back empty).
  if (webSearchEnabled()) {
    try {
      const articles = await searchNewsViaClaude(q);
      return NextResponse.json({ articles, web: true, via: "claude" });
    } catch (err) {
      console.error("[news/search] claude web search failed:", err);
    }
  }

  // Nothing live either — the client still offers a "browse on Google News" link.
  return NextResponse.json({ articles: [], web: true, via: null });
}
