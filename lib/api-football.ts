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
  // false when the API reports FINISHED but score.winner is still null (brief lag
  // right after full-time). Optional so hand-built test payloads default to true.
  hasResult?: boolean;
}

export interface StandingEntry {
  position: number;
  teamName: string;
  playedGames: number;
  points: number;
  goalDifference: number; // for ranking the best third-placed teams
  goalsFor: number;       // FIFA tiebreaker after points & goal difference
}

// A match plus its live status/kickoff — used by the match-aware cron gate to
// decide whether we're in an active window worth syncing.
export interface MatchWindowEntry extends CompletedMatch {
  status: string;  // TIMED | SCHEDULED | IN_PLAY | PAUSED | FINISHED | …
  utcDate: string; // ISO 8601 kickoff time
}

// A match with its full-time score — used by the points-history reconstruction
// to recompute group standings ourselves (the standings endpoint only reports
// the *current* table, not how it looked after each match).
export interface RawMatch extends MatchWindowEntry {
  homeGoals: number | null; // score.fullTime.home
  awayGoals: number | null; // score.fullTime.away
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

// Normalise one raw API match into our CompletedMatch shape.
function normaliseMatch(m: any): CompletedMatch {
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
    hasResult:    (m.score?.winner ?? null) !== null,
  };
}

// ─── Requests ─────────────────────────────────────────────────────────────────

// Fetch all FINISHED World Cup matches in a UTC date range (YYYY-MM-DD), inclusive.
// Callers should pass a window (e.g. yesterday→today) rather than a single day:
// the API dates matches by UTC kickoff, so a match finishing just before 00:00 UTC
// can otherwise fall out of a single-day query before any cron run picks it up.
// Draws are included — callers decide whether to use winnerName.
export async function fetchCompletedMatchesForDate(
  dateFrom: string,
  dateTo: string = dateFrom,
): Promise<CompletedMatch[]> {
  const res = await fetch(
    `${BASE}/competitions/${WC}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`football-data.org /matches ${res.status}`);
  const json = await res.json();
  return (json.matches ?? []).map(normaliseMatch);
}

// Fetch every WC match in a UTC date range (any status), with status + kickoff.
// Powers the match-aware cron gate, and its FINISHED entries can be processed
// directly (they're a superset of CompletedMatch).
export async function fetchMatchesWindow(
  dateFrom: string,
  dateTo: string = dateFrom,
): Promise<MatchWindowEntry[]> {
  const res = await fetch(
    `${BASE}/competitions/${WC}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`football-data.org /matches ${res.status}`);
  const json = await res.json();
  return (json.matches ?? []).map((m: any) => ({
    ...normaliseMatch(m),
    status:  m.status ?? "",
    utcDate: m.utcDate ?? "",
  } satisfies MatchWindowEntry));
}

// Fetch EVERY World Cup match (any status), with full-time scores + kickoff.
// One request covers the whole tournament (~104 matches). Used by the
// points-history reconstruction, which replays finished matches in order.
export async function fetchAllMatches(): Promise<RawMatch[]> {
  const res = await fetch(
    `${BASE}/competitions/${WC}/matches`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`football-data.org /matches ${res.status}`);
  const json = await res.json();
  return (json.matches ?? []).map((m: any) => ({
    ...normaliseMatch(m),
    status:    m.status ?? "",
    utcDate:   m.utcDate ?? "",
    homeGoals: m.score?.fullTime?.home ?? null,
    awayGoals: m.score?.fullTime?.away ?? null,
  } satisfies RawMatch));
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
    // API returns "Group A" (v4 2026 season) — older docs show "GROUP_A". Handle both.
    const letter = (group.group as string)?.replace(/^GROUP[_\s]/i, "").trim();
    if (!letter) continue;
    out.set(letter, (group.table ?? []).map((row: any) => ({
      position:       row.position as number,
      teamName:       row.team.name as string,
      playedGames:    row.playedGames as number,
      points:         (row.points ?? 0) as number,
      goalDifference: (row.goalDifference ?? 0) as number,
      goalsFor:       (row.goalsFor ?? 0) as number,
    })));
  }
  return out;
}
