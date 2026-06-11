// Temp: clear the idempotency row so the cron route re-processes the opener.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const url = readFileSync(".env.local", "utf8").match(/DATABASE_URL=(.+)/)[1].trim();
const sql = neon(url);
const r = await sql`DELETE FROM processed_fixtures WHERE fixture_id = 537327 RETURNING fixture_id`;
console.log("cleared:", JSON.stringify(r));
