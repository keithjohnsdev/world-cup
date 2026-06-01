// API-Football v3 client — World Cup 2026 only.
// Docs: https://www.api-football.com/documentation-v3
// Set API_FOOTBALL_KEY in env.

const BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE = 1;
const WC_SEASON = 2026;

function headers() {
  return {
    "x-rapidapi-host": "v3.football.api-sports.io",
    "x-rapidapi-key": process.env.API_FOOTBALL_KEY ?? "",
  };
}

// ─── Types (only the fields we use) ──────────────────────────────────────────

export interface ApiTeamRef {
  id: number;
  name: string;
  winner: boolean | null;
}

export interface ApiFix {
  fixture: {
    id: number;
    date: string;
    status: { short: string }; // NS 1H HT 2H ET P FT AET PEN
  };
  league: { round: string };
  teams: { home: ApiTeamRef; away: ApiTeamRef };
}

export interface ApiStandingEntry {
  rank: number;
  team: { id: number; name: string };
  group: string;
  all: { played: number };
}

// ─── Requests ─────────────────────────────────────────────────────────────────

// All World Cup fixtures for a given date (YYYY-MM-DD).
export async function fetchFixturesByDate(date: string): Promise<ApiFix[]> {
  const res = await fetch(
    `${BASE}/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&date=${date}`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`API-Football /fixtures ${res.status}`);
  const json = await res.json();
  return (json.response ?? []) as ApiFix[];
}

// Group standings — returns map of group letter ("A"…"L") → ranked entries.
// Only call this after group matches are complete; costs 1 request.
export async function fetchGroupStandings(): Promise<Map<string, ApiStandingEntry[]>> {
  const res = await fetch(
    `${BASE}/standings?league=${WC_LEAGUE}&season=${WC_SEASON}`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`API-Football /standings ${res.status}`);
  const json = await res.json();
  const raw: ApiStandingEntry[][] =
    json.response?.[0]?.league?.standings ?? [];

  const out = new Map<string, ApiStandingEntry[]>();
  for (const group of raw) {
    if (!group.length) continue;
    // group[0].group is "Group C" — extract letter
    const letter = group[0].group?.replace(/^Group\s+/i, "").trim();
    if (letter) out.set(letter, group);
  }
  return out;
}
