import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

interface ResultEntry {
  stage: string;
  slot: string;
  team_id: string;
  was_shootout?: boolean;
}

async function requireKeith(req: NextRequest) {
  const token = req.headers.get("x-session-token");
  if (!token) return null;
  const sql = getSql();
  const rows = await sql`SELECT name FROM users WHERE session_token = ${token}` as { name: string }[];
  if (!rows[0] || rows[0].name.toLowerCase() !== "keith") return null;
  return true;
}

// GET — return all current results for the admin panel to pre-populate
export async function GET(req: NextRequest) {
  await initDb();
  const ok = await requireKeith(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sql = getSql();
  const rows = await sql`
    SELECT stage, slot, team_id, was_shootout FROM results
    ORDER BY stage, slot
  ` as { stage: string; slot: string; team_id: string; was_shootout: boolean }[];

  return NextResponse.json({ results: rows });
}

// POST — bulk upsert results (same format as cron writes)
// Existing entries are overwritten so this is safe to call multiple times.
export async function POST(req: NextRequest) {
  await initDb();
  const ok = await requireKeith(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { entries } = await req.json() as { entries: ResultEntry[] };
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "No entries" }, { status: 400 });
  }

  const sql = getSql();
  const saved: string[] = [];

  for (const e of entries) {
    if (!e.stage || !e.slot || !e.team_id) continue;
    await sql`
      INSERT INTO results (stage, slot, team_id, was_shootout)
      VALUES (${e.stage}, ${e.slot}, ${e.team_id}, ${e.was_shootout ?? false})
      ON CONFLICT (stage, slot) DO UPDATE
        SET team_id      = EXCLUDED.team_id,
            was_shootout = EXCLUDED.was_shootout
    `;
    saved.push(`${e.stage}:${e.slot}`);
  }

  return NextResponse.json({ ok: true, saved });
}

// DELETE — remove a specific result (to correct a mistake)
export async function DELETE(req: NextRequest) {
  await initDb();
  const ok = await requireKeith(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { stage, slot } = await req.json() as { stage: string; slot: string };
  if (!stage || !slot) return NextResponse.json({ error: "Missing stage/slot" }, { status: 400 });

  const sql = getSql();
  await sql`DELETE FROM results WHERE stage = ${stage} AND slot = ${slot}`;
  return NextResponse.json({ ok: true });
}
