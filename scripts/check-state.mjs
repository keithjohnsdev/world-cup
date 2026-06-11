// Temp: dump processed_fixtures and results.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const url = readFileSync(".env.local", "utf8").match(/DATABASE_URL=(.+)/)[1].trim();
const sql = neon(url);
console.log("processed_fixtures:", JSON.stringify(await sql`SELECT * FROM processed_fixtures`));
const res = await sql`SELECT stage, slot, team_id FROM results ORDER BY stage, slot`;
for (const r of res) console.log(" ", JSON.stringify(r));
