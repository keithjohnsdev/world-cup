import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

// load .env.local
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const KEY = process.env.FOOTBALL_DATA_KEY;
const sql = neon(process.env.DATABASE_URL);

async function apiMatches(date) {
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${date}&dateTo=${date}`,
    { headers: { "X-Auth-Token": KEY } },
  );
  const json = await res.json();
  return (json.matches ?? []).map((m) => ({
    id: m.id,
    utcDate: m.utcDate,
    status: m.status,
    stage: m.stage,
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    winner: m.score?.winner ?? null,
    ft: m.score?.fullTime,
  }));
}

for (const d of ["2026-06-11", "2026-06-12", "2026-06-13"]) {
  console.log(`\n=== API matches utcDate ${d} ===`);
  for (const m of await apiMatches(d)) {
    console.log(`${m.id} ${m.utcDate} [${m.status}] ${m.stage} ${m.home} v ${m.away} winner=${m.winner} ft=${JSON.stringify(m.ft)}`);
  }
}

console.log("\n=== processed_fixtures ===");
const pf = await sql`SELECT fixture_id, processed_at FROM processed_fixtures ORDER BY processed_at`;
for (const r of pf) console.log(`${r.fixture_id} @ ${r.processed_at}`);

console.log("\n=== results (gm rows) ===");
const gm = await sql`SELECT slot, team_id, created_at FROM results WHERE stage='gm' ORDER BY created_at`;
for (const r of gm) console.log(`gm:${r.slot} -> ${r.team_id} @ ${r.created_at}`);
