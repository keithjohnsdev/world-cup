// Temp watcher: poll DB until the cron re-processes fixture 537327, then dump results.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const url = readFileSync(".env.local", "utf8").match(/DATABASE_URL=(.+)/)[1].trim();
const sql = neon(url);

const deadline = Date.now() + 25 * 60 * 1000;

while (Date.now() < deadline) {
  const pf = await sql`SELECT fixture_id, processed_at FROM processed_fixtures WHERE fixture_id = 537327`;
  if (pf.length > 0) {
    console.log("Re-processed:", JSON.stringify(pf));
    const res = await sql`SELECT * FROM results ORDER BY stage, slot`;
    console.log(`results rows (${res.length}):`);
    for (const r of res) console.log(" ", JSON.stringify(r));
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 60_000));
}

console.log("Timed out after 25 min — cron never re-processed fixture 537327.");
process.exit(1);
