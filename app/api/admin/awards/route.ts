import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { scoreUser, type UserRow, type PickRow, type ResultRow } from "@/lib/scoring";
import { computeAwards } from "@/lib/awards";
import type { SnapshotRow } from "@/lib/snapshots";

async function requireKeith(req: NextRequest) {
  const token = req.headers.get("x-session-token");
  if (!token) return null;
  const sql = getSql();
  const rows = await sql`SELECT name FROM users WHERE session_token = ${token}` as { name: string }[];
  if (!rows[0] || rows[0].name.toLowerCase() !== "keith") return null;
  return true;
}

// GET — return currently stored award winners
export async function GET(req: NextRequest) {
  await initDb();
  const ok = await requireKeith(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sql = getSql();
  const rows = await sql`
    SELECT name, user_id, user_name, reason, updated_at FROM awards ORDER BY name
  ` as { name: string; user_id: number | null; user_name: string; reason: string; updated_at: string }[];

  return NextResponse.json({ awards: rows });
}

// POST — (re)calculate all awards and persist them
export async function POST(req: NextRequest) {
  await initDb();
  const ok = await requireKeith(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sql = getSql();

  const [rawUsers, rawPicks, rawResults, rawSnapshots] = await Promise.all([
    sql`SELECT id, name, is_kid, chargeup_active, heart_pick_team_id FROM users`,
    sql`SELECT user_id, stage, slot, team_id, is_star_power FROM picks`,
    sql`SELECT stage, slot, team_id, was_shootout FROM results`,
    sql`SELECT round, user_id, rank, total_score, group_score, bracket_score FROM standings_snapshots`,
  ]) as [UserRow[], (PickRow & { user_id: number })[], ResultRow[], SnapshotRow[]];

  const picksByUser = new Map<number, PickRow[]>();
  for (const row of rawPicks) {
    const { user_id, ...pick } = row;
    if (!picksByUser.has(user_id)) picksByUser.set(user_id, []);
    picksByUser.get(user_id)!.push(pick as PickRow);
  }

  const breakdowns = rawUsers.map((user) =>
    scoreUser(user, picksByUser.get(user.id) ?? [], rawResults)
  );

  const awards = computeAwards({
    users: rawUsers,
    picksByUser,
    results: rawResults,
    breakdowns,
    snapshots: rawSnapshots,
  });

  // Persist
  for (const award of awards) {
    await sql`
      INSERT INTO awards (name, user_id, user_name, reason, updated_at)
      VALUES (${award.name}, ${award.userId}, ${award.userName}, ${award.reason}, NOW())
      ON CONFLICT (name) DO UPDATE
        SET user_id    = EXCLUDED.user_id,
            user_name  = EXCLUDED.user_name,
            reason     = EXCLUDED.reason,
            updated_at = EXCLUDED.updated_at
    `;
  }

  return NextResponse.json({ ok: true, count: awards.length, awards });
}
