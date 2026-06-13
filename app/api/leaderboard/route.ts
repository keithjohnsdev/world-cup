import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { scoreUser, type UserRow, type PickRow, type ResultRow } from "@/lib/scoring";
import { kabooseRoundsForUser, type SnapshotRow } from "@/lib/snapshots";

export async function GET(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const auth = await sql`SELECT id FROM users WHERE session_token = ${token}` as { id: number }[];
  if (!auth.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rawUsers, rawPicks, rawResults, phaseRows, rawSnapshots, rawPlayed] = await Promise.all([
    sql`SELECT id, name, is_kid, chargeup_active, heart_pick_team_id FROM users`,
    // ── Separate group and bracket picks to avoid accidental cross-stage scoring ──
    // We fetch all picks but the scoring engine already filters by stage via KNOCKOUT_PTS.
    // The explicit ORDER BY stage ensures group picks are processed before bracket picks
    // in case callers iterate in row order.
    sql`SELECT user_id, stage, slot, team_id, is_star_power
        FROM picks
        ORDER BY
          CASE stage
            WHEN 'group'    THEN 1
            WHEN 'runner'   THEN 2
            WHEN 'third'    THEN 3
            WHEN 'fourth'   THEN 4
            WHEN 'champion' THEN 5
            WHEN 'r32'      THEN 6
            WHEN 'r16'      THEN 7
            WHEN 'qf'       THEN 8
            WHEN 'sf'       THEN 9
            WHEN 'final'    THEN 10
            ELSE                 99
          END`,
    // ── Results: separate group standings from knockout winners ──
    // Fetch all results; scoring engine ignores gm/group/runner/third/fourth for
    // knockout scoring and ignores r32-final for group scoring automatically.
    sql`SELECT stage, slot, team_id, was_shootout FROM results`,
    sql`SELECT value FROM tournament_settings WHERE key = 'phase' LIMIT 1`,
    sql`SELECT round, user_id, rank, total_score, group_score, bracket_score
        FROM standings_snapshots`,
    sql`SELECT team_id FROM teams_played`,
  ]) as [UserRow[], (PickRow & { user_id: number })[], ResultRow[], { value: string }[], SnapshotRow[], { team_id: string }[]];

  const phase = phaseRows[0]?.value ?? "phase1_open";
  const playedTeams = new Set(rawPlayed.map((r) => r.team_id));

  // Group picks by user_id
  const picksByUser = new Map<number, PickRow[]>();
  for (const row of rawPicks) {
    const { user_id, ...pick } = row;
    if (!picksByUser.has(user_id)) picksByUser.set(user_id, []);
    picksByUser.get(user_id)!.push(pick as PickRow);
  }

  const entries = rawUsers
    .map((user) => {
      const kabooseRounds = kabooseRoundsForUser(user.id, rawSnapshots);
      const breakdown = scoreUser(
        user,
        picksByUser.get(user.id) ?? [],
        rawResults,
        kabooseRounds,
        playedTeams,
      );
      return {
        id: user.id,
        name: user.name,
        is_kid: user.is_kid,
        // Aggregate scores
        group_score:   breakdown.groupStage,
        bracket_score: breakdown.knockout,
        total_score:   breakdown.total,
        // Full breakdown for stats / awards display
        champion_bonus:  breakdown.championBonus,
        chargeup_bonus:  breakdown.chargeupBonus,
        heart_pick_bonus: breakdown.heartPickBonus,
        star_power_bonus: breakdown.starPowerBonus,
        kaboose_boosts:   breakdown.kabooseBoosts,
      };
    })
    .sort((a, b) => b.total_score - a.total_score || a.name.localeCompare(b.name));

  return NextResponse.json({ entries, phase });
}
