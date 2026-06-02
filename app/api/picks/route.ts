import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

const GROUP_STAGES = new Set(["group", "runner", "third", "fourth", "champion", "meta", "heart"]);
const KNOCKOUT_STAGES = new Set(["r32", "r16", "qf", "sf", "final"]);

async function getUser(req: NextRequest) {
  const token = req.headers.get("x-session-token");
  if (!token) return null;
  const sql = getSql();
  const rows = (await sql`SELECT id FROM users WHERE session_token = ${token}`) as { id: number }[];
  return rows[0] ?? null;
}

export async function GET(req: NextRequest) {
  await initDb();
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const picks = await sql`
    SELECT stage, slot, team_id FROM picks WHERE user_id = ${user.id}
  `;
  return NextResponse.json(picks);
}

export async function POST(req: NextRequest) {
  await initDb();
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stage, slot, teamId } = await req.json();
  if (!stage || !slot || !teamId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const sql = getSql();

  // Phase enforcement
  const phaseRows = await sql`SELECT value FROM tournament_settings WHERE key = 'phase' LIMIT 1` as { value: string }[];
  const phase = phaseRows[0]?.value ?? "phase1_open";

  if (GROUP_STAGES.has(stage) && phase !== "phase1_open") {
    return NextResponse.json({ error: "Phase 1 picks are locked" }, { status: 403 });
  }
  if (KNOCKOUT_STAGES.has(stage) && phase !== "phase2_open") {
    return NextResponse.json({ error: "Phase 2 picks are not open yet" }, { status: 403 });
  }

  await sql`
    INSERT INTO picks (user_id, stage, slot, team_id)
    VALUES (${user.id}, ${stage}, ${slot}, ${teamId})
    ON CONFLICT (user_id, stage, slot)
    DO UPDATE SET team_id = EXCLUDED.team_id, created_at = NOW()
  `;

  // Sync kid status to users table so scoring engine picks it up
  if (stage === "meta" && slot === "isKid") {
    const isKid = teamId === "true";
    await sql`UPDATE users SET is_kid = ${isKid}, chargeup_active = ${isKid} WHERE id = ${user.id}`;
  }

  // Sync heart pick to users table
  if (stage === "heart" && slot === "pick") {
    await sql`UPDATE users SET heart_pick_team_id = ${teamId} WHERE id = ${user.id}`;
  }

  return NextResponse.json({ ok: true });
}
