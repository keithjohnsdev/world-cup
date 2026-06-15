// Lazy, cached recap for the in-app reader. On first open of a story (per tone) we
// generate an original Claude recap (grounded on the source text) and store it;
// later opens read the cached copy. Returns recap: null when recaps are disabled
// or generation fails, so the client can fall back to the RSS summary + a link.

import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { fetchArticleText } from "@/lib/article-extract";
import { generateRecap, recapsEnabled, isRecapTone, type RecapTone } from "@/lib/recap";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // the Claude call can take a few seconds

interface Row {
  url: string;
  title: string;
  source: string;
  summary: string | null;
  recap: string | null;
  recap_comedic: string | null;
}

export async function GET(req: NextRequest) {
  await initDb();
  const sql = getSql();

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  const toneParam = req.nextUrl.searchParams.get("tone");
  const tone: RecapTone = isRecapTone(toneParam) ? toneParam : "straight";

  const rows = (await sql`
    SELECT url, title, source, summary, recap, recap_comedic
    FROM news_articles
    WHERE url = ${url}
    LIMIT 1
  `) as Row[];

  const article = rows[0];
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cached = tone === "comedic" ? article.recap_comedic : article.recap;
  if (cached) {
    return NextResponse.json({ recap: cached, tone, title: article.title, source: article.source });
  }

  // No key configured — let the client fall back to the summary + original link.
  if (!recapsEnabled()) {
    return NextResponse.json({ recap: null, tone, title: article.title, source: article.source });
  }

  try {
    const text = await fetchArticleText(article.url);
    const grounding = [article.summary, text].filter(Boolean).join("\n\n");
    const recap = await generateRecap({ title: article.title, source: article.source, text: grounding, tone });

    if (recap) {
      if (tone === "comedic") {
        await sql`UPDATE news_articles SET recap_comedic = ${recap} WHERE url = ${article.url}`;
      } else {
        await sql`UPDATE news_articles SET recap = ${recap}, recap_at = NOW() WHERE url = ${article.url}`;
      }
    }
    return NextResponse.json({ recap: recap || null, tone, title: article.title, source: article.source });
  } catch (err) {
    console.error("[news/recap] generation failed:", err);
    return NextResponse.json({ recap: null, tone, title: article.title, source: article.source });
  }
}
