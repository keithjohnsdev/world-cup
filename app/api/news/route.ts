// Public read API for the News tab. Returns deduped, traction-ranked stories,
// optionally filtered to a single country (team id). No auth — read-only public
// content, consistent with the other read routes.

import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface NewsRow {
  url: string;
  title: string;
  source: string;
  summary: string | null;
  image_url: string | null;
  published_at: string;
  countries: string[];
  cluster_id: string | null;
  source_count: number;
  traction: number;
}

export async function GET(req: NextRequest) {
  await initDb();
  const sql = getSql();

  const country = req.nextUrl.searchParams.get("country");
  const limitParam = parseInt(req.nextUrl.searchParams.get("limit") ?? "40", 10);
  const limit = Math.min(Math.max(isNaN(limitParam) ? 40 : limitParam, 1), 100);

  // Over-fetch so cluster dedupe still leaves a full page.
  const fetchLimit = limit * 4;
  const rows = (
    country
      ? await sql`
          SELECT url, title, source, summary, image_url, published_at,
                 countries, cluster_id, source_count, traction
          FROM news_articles
          WHERE countries @> ${JSON.stringify([country])}::jsonb
          ORDER BY traction DESC, published_at DESC
          LIMIT ${fetchLimit}
        `
      : await sql`
          SELECT url, title, source, summary, image_url, published_at,
                 countries, cluster_id, source_count, traction
          FROM news_articles
          ORDER BY traction DESC, published_at DESC
          LIMIT ${fetchLimit}
        `
  ) as NewsRow[];

  // One card per story: collapse clusters to their top-traction representative.
  const seen = new Set<string>();
  const articles = [];
  for (const r of rows) {
    const key = r.cluster_id ?? r.url;
    if (seen.has(key)) continue;
    seen.add(key);
    articles.push({
      url: r.url,
      title: r.title,
      source: r.source,
      summary: r.summary,
      imageUrl: r.image_url,
      publishedAt: r.published_at,
      countries: r.countries,
      sourceCount: r.source_count,
    });
    if (articles.length >= limit) break;
  }

  return NextResponse.json({ articles });
}
