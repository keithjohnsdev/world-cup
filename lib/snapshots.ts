// Standings snapshot helpers.
// Snapshots persist the leaderboard ranking at the start of each knockout round so
// that Kaboose Boost, Pacemaker, and Comeback Kid can be calculated correctly.

import { getSql } from "@/lib/db";
import { scoreUser, type UserRow, type PickRow, type ResultRow } from "@/lib/scoring";

type Sql = ReturnType<typeof getSql>;

export interface SnapshotRow {
  round: string;
  user_id: number;
  rank: number;
  total_score: number;
  group_score: number;
  bracket_score: number;
}

// Expected number of results for each knockout stage to be considered "complete".
const ROUND_RESULT_COUNTS: Record<string, number> = {
  r32: 16,
  r16: 8,
  qf:  4,
  sf:  2,
};

// Which snapshot round to take when a given stage completes.
const STAGE_TO_NEXT_SNAPSHOT: Record<string, string> = {
  r32: "pre_r16",
  r16: "pre_qf",
  qf:  "pre_sf",
  sf:  "pre_final",
};

// Compute current standings for all users and persist as a named snapshot.
// Idempotent — skips silently if a snapshot for this round already exists.
export async function takeStandingsSnapshot(sql: Sql, round: string): Promise<void> {
  const existing = await sql`
    SELECT 1 FROM standings_snapshots WHERE round = ${round} LIMIT 1
  ` as unknown[];
  if (existing.length > 0) return;

  const [rawUsers, rawPicks, rawResults] = await Promise.all([
    sql`SELECT id, name, is_kid, chargeup_active, heart_pick_team_id FROM users`,
    sql`SELECT user_id, stage, slot, team_id, is_star_power FROM picks`,
    sql`SELECT stage, slot, team_id, was_shootout FROM results`,
  ]) as [UserRow[], (PickRow & { user_id: number })[], ResultRow[]];

  // Group picks by user_id
  const picksByUser = new Map<number, PickRow[]>();
  for (const row of rawPicks) {
    const { user_id, ...pick } = row;
    if (!picksByUser.has(user_id)) picksByUser.set(user_id, []);
    picksByUser.get(user_id)!.push(pick as PickRow);
  }

  // Score and rank
  const scored = rawUsers
    .map((user) => ({
      userId: user.id,
      breakdown: scoreUser(user, picksByUser.get(user.id) ?? [], rawResults),
    }))
    .sort((a, b) => b.breakdown.total - a.breakdown.total || a.userId - b.userId);

  for (let i = 0; i < scored.length; i++) {
    const { userId, breakdown } = scored[i];
    await sql`
      INSERT INTO standings_snapshots (round, user_id, rank, total_score, group_score, bracket_score)
      VALUES (
        ${round}, ${userId}, ${i + 1},
        ${breakdown.total}, ${breakdown.groupStage}, ${breakdown.knockout}
      )
      ON CONFLICT (round, user_id) DO NOTHING
    `;
  }
}

// After writing a knockout result, check if that stage is now complete and
// if so, snapshot standings for the next round.  Pass the stage that was
// just written (e.g. "r32").
export async function maybeSnapshotAfterStage(sql: Sql, stage: string): Promise<void> {
  const expectedCount = ROUND_RESULT_COUNTS[stage];
  if (!expectedCount) return;

  const rows = await sql`
    SELECT COUNT(*) AS n FROM results WHERE stage = ${stage}
  ` as { n: string | number }[];
  const actual = Number(rows[0]?.n ?? 0);
  if (actual < expectedCount) return;

  const snapshotRound = STAGE_TO_NEXT_SNAPSHOT[stage];
  if (snapshotRound) await takeStandingsSnapshot(sql, snapshotRound);
}

// How many knockout rounds did this user start in last place?
// "Last place" = their score at the snapshot equals the minimum score across all users.
export function kabooseRoundsForUser(userId: number, snapshots: SnapshotRow[]): number {
  const roundNames = ["pre_r32", "pre_r16", "pre_qf", "pre_sf", "pre_final"];
  let count = 0;
  for (const round of roundNames) {
    const roundRows = snapshots.filter((s) => s.round === round);
    if (roundRows.length === 0) continue;
    const minScore = Math.min(...roundRows.map((s) => s.total_score));
    const userRow = roundRows.find((s) => s.user_id === userId);
    if (userRow && userRow.total_score === minScore) count++;
  }
  return count;
}
