import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

const VALID_PHASES = ["phase1_open", "phase1_locked", "phase2_open", "phase2_locked", "complete"] as const;
type Phase = typeof VALID_PHASES[number];

async function requireKeith(req: NextRequest) {
  const token = req.headers.get("x-session-token");
  if (!token) return null;
  const sql = getSql();
  const rows = await sql`SELECT name FROM users WHERE session_token = ${token}` as { name: string }[];
  if (!rows[0] || rows[0].name.toLowerCase() !== "keith") return null;
  return true;
}

export async function POST(req: NextRequest) {
  await initDb();
  const ok = await requireKeith(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { phase } = await req.json() as { phase: Phase };
  if (!VALID_PHASES.includes(phase)) {
    return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    INSERT INTO tournament_settings (key, value)
    VALUES ('phase', ${phase})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;

  return NextResponse.json({ ok: true, phase });
}
