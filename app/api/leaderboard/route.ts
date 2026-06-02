import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { scoreUser, type UserRow, type PickRow, type ResultRow } from "@/lib/scoring";
import { MOCK_GROUP_RESULTS } from "@/lib/mock-results";

export async function GET(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const auth = await sql`SELECT id FROM users WHERE session_token = ${token}` as { id: number }[];
  if (!auth.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rawUsers, rawPicks, rawResults] = await Promise.all([
    sql`SELECT id, name, is_kid, chargeup_active, heart_pick_team_id FROM users`,
    sql`SELECT user_id, stage, slot, team_id, is_star_power FROM picks`,
    sql`SELECT stage, slot, team_id, was_shootout FROM results`,
  ]);

  const users   = rawUsers   as UserRow[];
  const results = (rawResults as ResultRow[]).length > 0
    ? rawResults as ResultRow[]
    : MOCK_GROUP_RESULTS;

  // Group picks by user_id
  const picksByUser = new Map<number, PickRow[]>();
  for (const row of rawPicks as (PickRow & { user_id: number })[]) {
    const { user_id, ...pick } = row;
    if (!picksByUser.has(user_id)) picksByUser.set(user_id, []);
    picksByUser.get(user_id)!.push(pick);
  }

  const entries = users
    .map(user => {
      const breakdown = scoreUser(user, picksByUser.get(user.id) ?? [], results);
      return {
        id: user.id,
        name: user.name,
        is_kid: user.is_kid,
        group_score: breakdown.groupStage,
        bracket_score: breakdown.knockout,
        total_score: breakdown.total,
      };
    })
    .sort((a, b) => b.total_score - a.total_score || a.name.localeCompare(b.name));

  return NextResponse.json(entries);
}
