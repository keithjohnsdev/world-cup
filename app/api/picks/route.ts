import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { bracketLockedFor } from "@/lib/bracket-lock";
import { getBracketReopen, reopenAllowsStage } from "@/lib/bracket-reopen";

const GROUP_STAGES = new Set(["group", "runner", "third", "fourth", "champion", "meta", "heart"]);
const KNOCKOUT_STAGES = new Set(["r32", "r16", "qf", "sf", "final"]);
// The knockout bracket is open for live, saved picks from the moment the group
// stage is underway (phase1_locked) — built off the provisional Round of 32, which
// firms up as results land — right through phase2. It only locks once phase 2 closes.
const KNOCKOUT_OPEN_PHASES = new Set(["phase1_open", "phase1_locked", "phase2_open"]);

async function currentPhase(sql: ReturnType<typeof getSql>): Promise<string> {
  const rows = await sql`SELECT value FROM tournament_settings WHERE key = 'phase' LIMIT 1` as { value: string }[];
  return rows[0]?.value ?? "phase1_open";
}

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
  const phase = await currentPhase(sql);

  if (GROUP_STAGES.has(stage) && phase !== "phase1_open") {
    return NextResponse.json({ error: "Phase 1 picks are locked" }, { status: 403 });
  }
  if (KNOCKOUT_STAGES.has(stage) && !KNOCKOUT_OPEN_PHASES.has(phase)) {
    return NextResponse.json({ error: "Bracket picks are locked" }, { status: 403 });
  }
  if (KNOCKOUT_STAGES.has(stage) && await bracketLockedFor(sql, user.id)) {
    // A locked bracket may still be editable for specific stages during a scoped
    // re-open window (e.g. sf/final re-picks after the bracket structure was fixed).
    const reopen = await getBracketReopen(sql);
    if (!reopenAllowsStage(reopen, stage, Date.now())) {
      return NextResponse.json({ error: "Bracket picks are locked" }, { status: 403 });
    }
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

// Remove a single pick. Used by the live bracket to clear picks invalidated when the
// team a player advanced is no longer the one occupying that slot (e.g. a "likely"
// qualifier got overtaken as group results came in), so they can pick again.
export async function DELETE(req: NextRequest) {
  await initDb();
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stage, slot } = await req.json();
  if (!stage || !slot) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const sql = getSql();
  const phase = await currentPhase(sql);

  // Same gating as writes — only mutate picks while their phase is open.
  if (GROUP_STAGES.has(stage) && phase !== "phase1_open") {
    return NextResponse.json({ error: "Phase 1 picks are locked" }, { status: 403 });
  }
  if (KNOCKOUT_STAGES.has(stage) && !KNOCKOUT_OPEN_PHASES.has(phase)) {
    return NextResponse.json({ error: "Bracket picks are locked" }, { status: 403 });
  }
  if (KNOCKOUT_STAGES.has(stage) && await bracketLockedFor(sql, user.id)) {
    // A locked bracket may still be editable for specific stages during a scoped
    // re-open window (e.g. sf/final re-picks after the bracket structure was fixed).
    const reopen = await getBracketReopen(sql);
    if (!reopenAllowsStage(reopen, stage, Date.now())) {
      return NextResponse.json({ error: "Bracket picks are locked" }, { status: 403 });
    }
  }

  await sql`DELETE FROM picks WHERE user_id = ${user.id} AND stage = ${stage} AND slot = ${slot}`;
  return NextResponse.json({ ok: true });
}
