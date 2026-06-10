// Reference fixture — documents the raw football-data.org API response shape
// and the CompletedMatch[] our parser should produce from it.
//
// Use this to validate that fetchCompletedMatchesForDate() is parsing correctly
// once real data starts flowing. Compare actual API responses against these shapes.

import type { CompletedMatch } from "@/lib/api-football";

// ─── Raw API shapes (what football-data.org actually returns) ─────────────────

// GET /v4/competitions/WC/matches?status=FINISHED&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
export interface RawMatchesResponse {
  matches: RawMatch[];
}

export interface RawMatch {
  id: number;
  stage: string;       // "GROUP_STAGE" | "ROUND_OF_32" | "ROUND_OF_16" | "QUARTER_FINALS" | "SEMI_FINALS" | "FINAL"
  matchday: number | null;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
    fullTime: { home: number | null; away: number | null };
  };
}

// GET /v4/competitions/WC/standings
export interface RawStandingsResponse {
  standings: RawStandingGroup[];
}

export interface RawStandingGroup {
  stage: string;   // "GROUP_STAGE"
  type: string;    // "TOTAL"
  group: string;   // "GROUP_A" | "GROUP_B" | … | "GROUP_L"
  table: RawStandingRow[];
}

export interface RawStandingRow {
  position: number;          // 1-4
  team: { id: number; name: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

// ─── Example payloads ─────────────────────────────────────────────────────────

// Group stage: Mexico wins (regular time)
export const EXAMPLE_GROUP_WIN: RawMatch = {
  id: 415082,
  stage: "GROUP_STAGE",
  matchday: 1,
  homeTeam: { id: 758, name: "Mexico" },
  awayTeam: { id: 815, name: "South Africa" },
  score: {
    winner: "HOME_TEAM",
    duration: "REGULAR",
    fullTime: { home: 2, away: 0 },
  },
};

// Group stage: draw (no winner written to gm results)
export const EXAMPLE_GROUP_DRAW: RawMatch = {
  id: 415083,
  stage: "GROUP_STAGE",
  matchday: 1,
  homeTeam: { id: 827, name: "South Korea" },
  awayTeam: { id: 849, name: "Czechia" },
  score: {
    winner: "DRAW",
    duration: "REGULAR",
    fullTime: { home: 1, away: 1 },
  },
};

// Knockout: Round of 32, decided by penalty shootout
export const EXAMPLE_KNOCKOUT_SHOOTOUT: RawMatch = {
  id: 415120,
  stage: "ROUND_OF_32",
  matchday: null,
  homeTeam: { id: 758, name: "Mexico" },
  awayTeam: { id: 762, name: "Switzerland" },
  score: {
    winner: "AWAY_TEAM",
    duration: "PENALTY_SHOOTOUT",
    fullTime: { home: 1, away: 1 },
  },
};

// Knockout: Round of 32, decided in extra time (not a shootout)
export const EXAMPLE_KNOCKOUT_EXTRA_TIME: RawMatch = {
  id: 415121,
  stage: "ROUND_OF_32",
  matchday: null,
  homeTeam: { id: 764, name: "Brazil" },
  awayTeam: { id: 773, name: "Morocco" },
  score: {
    winner: "HOME_TEAM",
    duration: "EXTRA_TIME",
    fullTime: { home: 2, away: 1 },
  },
};

// Sample standings group (Group A after matchday 1)
export const EXAMPLE_STANDINGS_GROUP_A: RawStandingGroup = {
  stage: "GROUP_STAGE",
  type: "TOTAL",
  group: "GROUP_A",
  table: [
    { position: 1, team: { id: 758, name: "Mexico" },       playedGames: 1, won: 1, draw: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, goalDifference: 2,  points: 3 },
    { position: 2, team: { id: 827, name: "South Korea" },  playedGames: 1, won: 0, draw: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, goalDifference: 0,  points: 1 },
    { position: 3, team: { id: 849, name: "Czechia" },      playedGames: 1, won: 0, draw: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, goalDifference: 0,  points: 1 },
    { position: 4, team: { id: 815, name: "South Africa" }, playedGames: 1, won: 0, draw: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, goalDifference: -2, points: 0 },
  ],
};

// ─── Expected parsed output ───────────────────────────────────────────────────
// What fetchCompletedMatchesForDate() should produce from the raw examples above.

export const EXPECTED_PARSED: CompletedMatch[] = [
  {
    id: 415082,
    round: "group stage",
    matchday: 1,
    homeTeamName: "Mexico",
    awayTeamName: "South Africa",
    winnerName: "Mexico",
    wasShootout: false,
  },
  {
    id: 415083,
    round: "group stage",
    matchday: 1,
    homeTeamName: "South Korea",
    awayTeamName: "Czechia",
    winnerName: "",        // draw → no winner
    wasShootout: false,
  },
  {
    id: 415120,
    round: "round of 32",
    matchday: null,
    homeTeamName: "Mexico",
    awayTeamName: "Switzerland",
    winnerName: "Switzerland",
    wasShootout: true,     // PENALTY_SHOOTOUT → half-point mercy rule applies
  },
  {
    id: 415121,
    round: "round of 32",
    matchday: null,
    homeTeamName: "Brazil",
    awayTeamName: "Morocco",
    winnerName: "Brazil",
    wasShootout: false,    // EXTRA_TIME is not a shootout
  },
];
