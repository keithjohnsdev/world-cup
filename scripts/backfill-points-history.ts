// One-off / re-runnable: rebuild the points_history table from a full
// chronological replay of every finished World Cup match. Safe to run anytime
// (idempotent — it wipes and re-materialises the table). Also runs automatically
// from the results cron, but use this to seed it the first time.
// Run: FOOTBALL_DATA_KEY=… DATABASE_URL=… npx tsx scripts/backfill-points-history.ts
import { initDb, getSql } from "../lib/db";
import { rebuildPointsHistory } from "../lib/points-history";

async function main() {
  if (!process.env.FOOTBALL_DATA_KEY) throw new Error("FOOTBALL_DATA_KEY not set");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

  await initDb();
  const { games, rows } = await rebuildPointsHistory(getSql());
  console.log(`Rebuilt points_history: ${games} games × players = ${rows} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
