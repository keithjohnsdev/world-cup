import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const [auth, rows, phaseRows] = await Promise.all([
    sql`SELECT id FROM users WHERE session_token = ${token}`,
    sql`SELECT stage, slot, team_id FROM results`,
    sql`SELECT value FROM tournament_settings WHERE key = 'phase' LIMIT 1`,
  ]);

  if (!(auth as { id: number }[]).length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    results: rows,
    phase: (phaseRows as { value: string }[])[0]?.value ?? "phase1_open",
  });
}
