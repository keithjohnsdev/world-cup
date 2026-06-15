// On-demand web search fallback for the News tab. The client calls this only
// after /api/news returns no aggregated stories for a query, so it stays off the
// hot path. Returns { articles, web: true } so the UI can label them as live
// web results. No auth — read-only public content, like the other news routes.

import { NextRequest, NextResponse } from "next/server";
import { searchNewsViaClaude, webSearchEnabled } from "@/lib/news-search";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // web search + the Claude call can take a few seconds

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ articles: [], web: true });

  // No key configured — nothing to fall back to; the UI keeps its empty state.
  if (!webSearchEnabled()) {
    return NextResponse.json({ articles: [], web: true, enabled: false });
  }

  try {
    const articles = await searchNewsViaClaude(q);
    return NextResponse.json({ articles, web: true });
  } catch (err) {
    console.error("[news/search] web search failed:", err);
    return NextResponse.json({ articles: [], web: true, error: true }, { status: 200 });
  }
}
