// football-data.org v4 client — World Cup 2026.
// Docs: https://www.football-data.org/documentation/api
// Set FOOTBALL_DATA_KEY in env (free tier: 10 req/min, no daily cap).

const BASE = "https://api.football-data.org/v4";
const WC = "WC";

function headers() {
  return { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY ?? "" };
}

// ─── Normalised types (used by cron route) ────────────────────────────────────

export interface CompletedMatch {
  id: number;
  round: string;       // normalised to lowercase for findKnockoutSlot
  matchday: number | null;
  homeTeamName: string;
  awayTeamName: string;
  winnerName: string;  // empty string for draws
  wasShootout: boolean;
}

export interface StandingEntry {
  position: number;
  teamName: string;
  playedGames: number;
}

// ─── Round name normalisation ─────────────────────────────────────────────────

function normaliseRound(stage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE:    "group stage",
    ROUND_OF_32:    "round of 32",
    ROUND_OF_16:    "round of 16",
    QUARTER_FINALS: "quarter-finals",
    SEMI_FINALS:    "semi-finals",
    FINAL:          "final",
  };
  return map[stage] ?? stage.toLowerCase().replace(/_/g, " ");
}

// ─── Requests ─────────────────────────────────────────────────────────────────

// Fetch all FINISHED World Cup matches on a given date (YYYY-MM-DD).
// Draws are included — callers decide whether to use winnerName.
export async function fetchCompletedMatchesForDate(date: string): Promise<CompletedMatch[]> {
  const res = await fetch(
    `${BASE}/competitions/${WC}/matches?status=FINISHED&dateFrom=${date}&dateTo=${date}`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`football-data.org /matches ${res.status}`);
  const json = await res.json();

  return (json.matches ?? []).map((m: any) => {
    const winnerField: string = m.score?.winner ?? "";
    const winnerName =
      winnerField === "HOME_TEAM" ? m.homeTeam.name :
      winnerField === "AWAY_TEAM" ? m.awayTeam.name :
      "";

    return {
      id:           m.id,
      round:        normaliseRound(m.stage ?? ""),
      matchday:     m.matchday ?? null,
      homeTeamName: m.homeTeam.name,
      awayTeamName: m.awayTeam.name,
      winnerName,
      wasShootout:  m.score?.duration === "PENALTY_SHOOTOUT",
    } satisfies CompletedMatch;
  });
}

// Fetch group standings — returns map of group letter ("A"…"L") → entries sorted by position.
export async function fetchGroupStandings(): Promise<Map<string, StandingEntry[]>> {
  const res = await fetch(
    `${BASE}/competitions/${WC}/standings`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`football-data.org /standings ${res.status}`);
  const json = await res.json();

  const out = new Map<string, StandingEntry[]>();
  for (const group of (json.standings ?? [])) {
    const letter = (group.group as string)?.replace(/^GROUP_/i, "").trim();
    if (!letter) continue;
    out.set(letter, (group.table ?? []).map((row: any) => ({
      position:    row.position as number,
      teamName:    row.team.name as string,
      playedGames: row.playedGames as number,
    })));
  }
  return out;
}
