// One-off / re-runnable: compute the stats snapshot from the full match list.
// Safe to run anytime (idempotent — overwrites the single stats_snapshot row).
// Also runs automatically from the results cron; use this to seed it now.
// Run: FOOTBALL_DATA_KEY=… DATABASE_URL=… npx tsx --env-file=.env.local scripts/backfill-stats.ts
import { initDb, getSql } from "../lib/db";
import { fetchAllMatches } from "../lib/api-football";
import { rebuildStats } from "../lib/stats";

async function main() {
  if (!process.env.FOOTBALL_DATA_KEY) throw new Error("FOOTBALL_DATA_KEY not set");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

  await initDb();
  const matches = await fetchAllMatches();
  const { count } = await rebuildStats(matches, getSql());
  console.log(`Rebuilt stats_snapshot: ${count} stats`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
