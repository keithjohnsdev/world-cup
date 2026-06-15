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
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limitParam = parseInt(req.nextUrl.searchParams.get("limit") ?? "40", 10);
  const limit = Math.min(Math.max(isNaN(limitParam) ? 40 : limitParam, 1), 100);

  // Compose the optional filters into one parameterized query.
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (country) {
    params.push(JSON.stringify([country]));
    conditions.push(`countries @> $${params.length}::jsonb`);
  }
  if (q) {
    // Escape LIKE wildcards so a literal % or _ in the query stays literal.
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(pattern);
    conditions.push(`(title ILIKE $${params.length} OR summary ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Over-fetch so cluster dedupe still leaves a full page.
  const fetchLimit = limit * 4;
  params.push(fetchLimit);
  const rows = (await sql.query(
    `SELECT url, title, source, summary, image_url, published_at,
            countries, cluster_id, source_count, traction
     FROM news_articles
     ${where}
     ORDER BY traction DESC, published_at DESC
     LIMIT $${params.length}`,
    params,
  )) as NewsRow[];

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
