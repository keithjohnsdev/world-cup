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
    // football-data.org v4 reports the 48-team knockout rounds as LAST_32 / LAST_16
    // (not ROUND_OF_*). Map both spellings so findKnockoutSlot recognises them.
    LAST_32:        "round of 32",
    ROUND_OF_32:    "round of 32",
    LAST_16:        "round of 16",
    ROUND_OF_16:    "round of 16",
    QUARTER_FINALS: "quarter-finals",
    SEMI_FINALS:    "semi-finals",
    FINAL:          "final",
  };
  return map[stage] ?? stage.toLowerCase().replace(/_/g, " ");
}

// Resolve the winning side's team name for a match.
//
// Normally we trust score.winner. But the football-data free tier sometimes
// publishes a FINISHED knockout decided in regulation/extra time with
// score.winner still null for a while. There the fullTime score is decisive
// (a genuine non-level result), so we fall back to it rather than leave a
// decided match stuck unprocessed.
//
// Penalty shootouts are the dangerous exception. For a shootout the regulation
// score is level and fullTime *folds the shootout tally in* — but the free tier
// can publish that tally mid-flight or stale, so fullTime may briefly show the
// side that actually LOST the shootout ahead. Inferring a winner from it then
// locks in the wrong team (and processed_fixtures makes it permanent). So for a
// shootout we trust ONLY an explicit winner; until the feed sets one we leave it
// unresolved and let a later run pick up the real result.
//
// A level fullTime (a real group-stage draw) yields "" and stays unresolved,
// which is correct — group draws carry no winner, and a knockout reported level
// simply isn't decided yet in the feed.
function resolveWinnerName(m: any): string {
  const winnerField: string = m.score?.winner ?? "";
  if (winnerField === "HOME_TEAM") return m.homeTeam?.name ?? "";
  if (winnerField === "AWAY_TEAM") return m.awayTeam?.name ?? "";
  if ((m.score?.duration ?? "") === "PENALTY_SHOOTOUT") return "";
  const ftH = m.score?.fullTime?.home ?? null;
  const ftA = m.score?.fullTime?.away ?? null;
  if ((m.status ?? "") === "FINISHED" && ftH != null && ftA != null && ftH !== ftA) {
    return ftH > ftA ? (m.homeTeam?.name ?? "") : (m.awayTeam?.name ?? "");
  }
  return "";
}

// Normalise one raw API match into our CompletedMatch shape.
function normaliseMatch(m: any): CompletedMatch {
  const winnerName = resolveWinnerName(m);
  return {
    id:           m.id,
    round:        normaliseRound(m.stage ?? ""),
    matchday:     m.matchday ?? null,
    homeTeamName: m.homeTeam.name,
    awayTeamName: m.awayTeam.name,
    winnerName,
    wasShootout:  m.score?.duration === "PENALTY_SHOOTOUT",
    // Resolved if the API set an explicit winner (incl. a "DRAW" for group
    // matches) OR we inferred a winner from a decisive fullTime. A finished
    // match left level with a null winner stays unresolved so the next run retries.
    hasResult:    (m.score?.winner ?? null) !== null || winnerName !== "",
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

// A match shaped for on-screen display: kickoff, status, and a clean scoreline
// (regulation/ET goals split out from any shootout, so the UI can show "1–1 (3–2 pens)").
// Team names are left un-mapped here; callers map them to our ids.
export interface DisplayMatch {
  id: number;
  round: string;       // normalised ("group stage", "round of 32", …)
  matchday: number | null;
  status: string;      // TIMED | SCHEDULED | IN_PLAY | PAUSED | FINISHED | …
  utcDate: string;     // ISO 8601 kickoff
  homeTeamName: string;
  awayTeamName: string;
  winnerName: string;  // "" for a draw / not-yet-decided
  wasShootout: boolean;
  homeGoals: number | null; // goals after regulation + extra time (shootout excluded)
  awayGoals: number | null;
  homePens: number | null;  // shootout tally (null when not a shootout)
  awayPens: number | null;
}

// Fetch EVERY World Cup match shaped for display (one request, ~104 matches).
// Powers the real-results bracket's team-history modal.
export async function fetchDisplayMatches(): Promise<DisplayMatch[]> {
  const res = await fetch(`${BASE}/competitions/${WC}/matches`, { headers: headers() });
  if (!res.ok) throw new Error(`football-data.org /matches ${res.status}`);
  const json = await res.json();
  return (json.matches ?? []).map((m: any): DisplayMatch => {
    const shootout = m.score?.duration === "PENALTY_SHOOTOUT";
    const ftH = m.score?.fullTime?.home ?? null;
    const ftA = m.score?.fullTime?.away ?? null;

    let homeGoals = ftH;
    let awayGoals = ftA;
    let homePens: number | null = null;
    let awayPens: number | null = null;
    if (shootout) {
      // football-data folds the shootout tally into fullTime for penalty finishes.
      // Prefer regulation(+ET) for the level scoreline and derive the shootout
      // tally from fullTime (the authoritative total) — the standalone penalties
      // field is sometimes stale/incorrect on the free tier. Fall back to peeling
      // penalties off fullTime only when regulation isn't reported.
      const regH = m.score?.regularTime?.home ?? null;
      const regA = m.score?.regularTime?.away ?? null;
      if (regH != null && regA != null) {
        homeGoals = regH + (m.score?.extraTime?.home ?? 0);
        awayGoals = regA + (m.score?.extraTime?.away ?? 0);
        homePens = ftH != null ? ftH - homeGoals : (m.score?.penalties?.home ?? null);
        awayPens = ftA != null ? ftA - awayGoals : (m.score?.penalties?.away ?? null);
      } else {
        const penH = m.score?.penalties?.home ?? null;
        const penA = m.score?.penalties?.away ?? null;
        homeGoals = ftH != null && penH != null ? ftH - penH : ftH;
        awayGoals = ftA != null && penA != null ? ftA - penA : ftA;
        homePens = penH;
        awayPens = penA;
      }
    }
    return {
      id: m.id,
      round: normaliseRound(m.stage ?? ""),
      matchday: m.matchday ?? null,
      status: m.status ?? "",
      utcDate: m.utcDate ?? "",
      homeTeamName: m.homeTeam?.name ?? "",
      awayTeamName: m.awayTeam?.name ?? "",
      winnerName: resolveWinnerName(m),
      wasShootout: shootout,
      homeGoals,
      awayGoals,
      homePens,
      awayPens,
    };
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
