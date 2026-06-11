// Temp check: did the cron process today's match(es)?
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const url = readFileSync(".env.local", "utf8").match(/DATABASE_URL=(.*)/)[1].trim();
const sql = neon(url);

const pf = await sql`SELECT * FROM processed_fixtures ORDER BY fixture_id`;
console.log("processed_fixtures:", JSON.stringify(pf));

const res = await sql`SELECT * FROM results ORDER BY stage, slot`;
console.log("results:");
for (const r of res) console.log(" ", JSON.stringify(r));
