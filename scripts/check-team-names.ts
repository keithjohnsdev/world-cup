// One-off / ad-hoc audit: fetch every team name football-data.org uses for the
// WC competition and confirm each resolves via apiNameToTeamId. Catches name
// mismatches (e.g. "Cape Verde Islands") before a real result silently fails to
// process. Run: FOOTBALL_DATA_KEY=… npx tsx scripts/check-team-names.ts
import { apiNameToTeamId } from "../lib/team-mapping";

const BASE = "https://api.football-data.org/v4";

async function main() {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) throw new Error("FOOTBALL_DATA_KEY not set");

  const res = await fetch(`${BASE}/competitions/WC/teams`, {
    headers: { "X-Auth-Token": key },
  });
  if (!res.ok) throw new Error(`/teams ${res.status}`);
  const json: any = await res.json();
  const names: string[] = (json.teams ?? []).map((t: any) => t.name);

  const unmapped = names.filter((n) => !apiNameToTeamId(n));
  console.log(`Total API teams: ${names.length}`);
  if (unmapped.length === 0) {
    console.log("OK — every API team name maps to a team id");
  } else {
    console.log(`UNMAPPED (${unmapped.length}):`);
    unmapped.forEach((n) => console.log("  - " + JSON.stringify(n)));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
