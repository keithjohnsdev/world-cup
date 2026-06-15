// News-sync routine, run alongside the results sync on every cron tick. Pulls the
// RSS feeds, clusters/scores stories, upserts them, and prunes stale rows. Kept
// separate from the results sync so a feed outage never affects scoring.

import { initDb, getSql } from "@/lib/db";
import { fetchAllNews, clusterAndScore } from "@/lib/news";
import { NEWS_SOURCES } from "@/lib/news-sources";

const PRUNE_AFTER_DAYS = 7;
const UPSERT_CHUNK = 20;

export interface NewsSyncResult {
  fetched: number;
  upserted: number;
  pruned: number;
  sources: number;
  errors: { source: string; error: string }[];
}

export async function runNewsSync(): Promise<NewsSyncResult> {
  await initDb();
  const sql = getSql();

  const { articles, errors } = await fetchAllNews();
  const scored = clusterAndScore(articles);

  // url is the PK, so this refreshes traction/source_count for stories we've seen
  // before and inserts new ones. Chunked Promise.all keeps the round-trips bounded.
  let upserted = 0;
  for (let i = 0; i < scored.length; i += UPSERT_CHUNK) {
    const chunk = scored.slice(i, i + UPSERT_CHUNK);
    await Promise.all(
      chunk.map(
        (a) => sql`
          INSERT INTO news_articles
            (url, title, source, summary, image_url, published_at,
             countries, cluster_id, source_count, traction, fetched_at)
          VALUES
            (${a.url}, ${a.title}, ${a.source}, ${a.summary}, ${a.imageUrl},
             ${a.publishedAt.toISOString()}, ${JSON.stringify(a.countries)}::jsonb,
             ${a.clusterId}, ${a.sourceCount}, ${a.traction}, NOW())
          ON CONFLICT (url) DO UPDATE SET
            title        = EXCLUDED.title,
            summary      = EXCLUDED.summary,
            image_url    = EXCLUDED.image_url,
            countries    = EXCLUDED.countries,
            cluster_id   = EXCLUDED.cluster_id,
            source_count = EXCLUDED.source_count,
            traction     = EXCLUDED.traction,
            fetched_at   = NOW()
        `,
      ),
    );
    upserted += chunk.length;
  }

  const prunedRows = (await sql`
    DELETE FROM news_articles
    WHERE published_at < NOW() - ${`${PRUNE_AFTER_DAYS} days`}::interval
    RETURNING url
  `) as { url: string }[];
  const pruned = prunedRows.length;

  return {
    fetched: articles.length,
    upserted,
    pruned,
    sources: NEWS_SOURCES.length,
    errors,
  };
}
