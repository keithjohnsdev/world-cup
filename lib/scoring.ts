// Scoring engine for Johnsies World Cup 2026 bracket challenge.
// All inputs come from the DB; call scoreUser() to get a full breakdown.

import { GROUPS } from "@/lib/data";

// ─── Constants ────────────────────────────────────────────────────────────────

const KNOCKOUT_PTS: Record<string, number> = {
  r32:   2,
  r16:   4,
  qf:    8,
  sf:    16,
  final: 32,
};

const CHAMPION_BONUS_BASE = 10;
const CHARGEUP_BONUS      = 20; // replaces base for kids with chargeup_active
const HEART_PICK_WIN_PTS  = 1;
const KABOOSE_BOOST_PTS   = 3;

// ─── Input shapes (mirror DB rows) ───────────────────────────────────────────

export interface UserRow {
  id: number;
  name: string;
  is_kid: boolean;
  chargeup_active: boolean;   // kid power: champion bonus ×2
  heart_pick_team_id: string | null; // kid power: +1 per win for this team
}

export interface PickRow {
  stage: string;
  slot: string;
  team_id: string;
  is_star_power: boolean; // kid power: double points for this one pick
}

export interface ResultRow {
  stage: string;
  slot: string;
  team_id: string;        // winning team
  was_shootout: boolean;  // mercy rule: half points if picked loser
}

// ─── Output shape ─────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  userId: number;
  name: string;
  total: number;

  groupStage: number;
  knockout: number;
  championBonus: number;

  // Kid power bonuses (0 for non-kids)
  heartPickBonus: number;
  starPowerBonus: number;   // extra pts from the star pick doubling
  kabooseBoosts: number;    // total boost pts awarded across rounds
  chargeupBonus: number;    // extra 10 pts if champion wins + chargeup was active
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickMap(picks: PickRow[]): Map<string, PickRow> {
  const m = new Map<string, PickRow>();
  for (const p of picks) m.set(`${p.stage}:${p.slot}`, p);
  return m;
}

function resultMap(results: ResultRow[]): Map<string, ResultRow> {
  const m = new Map<string, ResultRow>();
  for (const r of results) m.set(`${r.stage}:${r.slot}`, r);
  return m;
}

// ─── Group stage ──────────────────────────────────────────────────────────────

// For each group, results contains four entries:
//   stage="group" slot="A" team_id=<1st place team>
//   stage="runner" slot="A" team_id=<2nd place team>
//   stage="third" slot="A" team_id=<3rd place team>
//   stage="fourth" slot="A" team_id=<4th place team>
// Picks use the same convention.

function scoreGroupStage(picks: Map<string, PickRow>, results: Map<string, ResultRow>): number {
  let pts = 0;
  const positions = ["group", "runner", "third", "fourth"] as const;

  for (const group of GROUPS) {
    const g = group.id;
    const actual = positions.map(pos => results.get(`${pos}:${g}`)?.team_id ?? null);
    const predicted = positions.map(pos => picks.get(`${pos}:${g}`)?.team_id ?? null);

    // 2 pts: picked this team 1st or 2nd and it actually finished 1st or 2nd
    const advancers = new Set([actual[0], actual[1]].filter(Boolean));
    for (let i = 0; i < 2; i++) {
      if (predicted[i] && advancers.has(predicted[i]!)) pts += 2;
    }

    // 1 pt: exact position match (any of the four positions)
    for (let i = 0; i < 4; i++) {
      if (predicted[i] && predicted[i] === actual[i]) pts += 1;
    }
  }

  return pts;
}

// ─── Knockout rounds ──────────────────────────────────────────────────────────

// Each match: stage=<round> slot=<matchId> team_id=<winner>
// A pick is correct if team_id matches result team_id.
// Shootout mercy: if the pick's team LOST in a shootout, award half points.

function scoreKnockout(
  picks: Map<string, PickRow>,
  results: Map<string, ResultRow>,
): { pts: number; starPowerExtra: number } {
  let pts = 0;
  let starPowerExtra = 0;

  for (const [key, result] of results) {
    const [stage] = key.split(":");
    const base = KNOCKOUT_PTS[stage];
    if (!base) continue; // not a knockout stage (e.g. group/runner/third/fourth)

    const pick = picks.get(key);
    if (!pick) continue;

    const correct = pick.team_id === result.team_id;
    const lostInShootout = !correct && result.was_shootout;

    let earned = 0;
    if (correct) {
      earned = base;
    } else if (lostInShootout) {
      earned = base / 2;
    }

    if (pick.is_star_power && correct) {
      // Star power: double the earned points; extra = earned (we already have base, add another base)
      starPowerExtra += earned;
      earned += earned;
    }

    pts += earned;
  }

  return { pts, starPowerExtra };
}

// ─── Champion bonus ───────────────────────────────────────────────────────────

function scoreChampionBonus(
  picks: Map<string, PickRow>,
  results: Map<string, ResultRow>,
  user: UserRow,
): { championBonus: number; chargeupBonus: number } {
  const pick = picks.get("champion:pick");
  const result = results.get("final:m1");
  if (!pick || !result || pick.team_id !== result.team_id) {
    return { championBonus: 0, chargeupBonus: 0 };
  }

  const base = CHAMPION_BONUS_BASE;
  const chargeupBonus = user.is_kid && user.chargeup_active ? base : 0;
  return { championBonus: base, chargeupBonus };
}

// ─── Heart pick bonus (kids only) ─────────────────────────────────────────────

// +1 pt for every match (any round) that the heart-pick team won.
// "Won" means their team_id appears in results as the winner of that match.

// Stages that represent final standings positions, not individual match wins
const STANDING_STAGES = new Set(["group", "runner", "third", "fourth"]);

function scoreHeartPick(user: UserRow, results: Map<string, ResultRow>): number {
  if (!user.is_kid || !user.heart_pick_team_id) return 0;
  let pts = 0;
  for (const [key, result] of results) {
    const stage = key.split(":")[0];
    if (STANDING_STAGES.has(stage)) continue; // not a match win
    if (result.team_id === user.heart_pick_team_id) pts += HEART_PICK_WIN_PTS;
  }
  return pts;
}

// ─── Kaboose boost (kids only) ───────────────────────────────────────────────

// +3 pts each time the kid STARTED a round in last place.
// Caller provides how many rounds this happened — computed from standings snapshots
// taken at the start of each round (not derivable from picks/results alone).
// Pass 0 until standings tracking is implemented.

function scoreKabooseBoost(user: UserRow, roundsInLastPlace: number): number {
  if (!user.is_kid) return 0;
  return roundsInLastPlace * KABOOSE_BOOST_PTS;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function scoreUser(
  user: UserRow,
  picks: PickRow[],
  results: ResultRow[],
  // Number of rounds this user started in last place (for Kaboose Boost).
  // Provide 0 until standings-snapshot tracking is wired up.
  kabooseRoundsInLast = 0,
): ScoreBreakdown {
  const pm = pickMap(picks);
  const rm = resultMap(results);

  const groupStage = scoreGroupStage(pm, rm);
  const { pts: knockout, starPowerExtra } = scoreKnockout(pm, rm);
  const { championBonus, chargeupBonus } = scoreChampionBonus(pm, rm, user);
  const heartPickBonus = scoreHeartPick(user, rm);
  const kabooseBoosts = scoreKabooseBoost(user, kabooseRoundsInLast);

  const total =
    groupStage +
    knockout +
    championBonus +
    chargeupBonus +
    heartPickBonus +
    kabooseBoosts;
  // starPowerExtra is already included in knockout pts above

  return {
    userId: user.id,
    name: user.name,
    total,
    groupStage,
    knockout,
    championBonus,
    heartPickBonus,
    starPowerBonus: starPowerExtra,
    kabooseBoosts,
    chargeupBonus,
  };
}
