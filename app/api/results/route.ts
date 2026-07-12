import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { bracketLockedFor } from "@/lib/bracket-lock";
import { getBracketReopen } from "@/lib/bracket-reopen";

export async function GET(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const [auth, rows, phaseRows, awardsRows, standings] = await Promise.all([
    sql`SELECT id FROM users WHERE session_token = ${token}`,
    sql`SELECT stage, slot, team_id FROM results`,
    sql`SELECT value FROM tournament_settings WHERE key = 'phase' LIMIT 1`,
    sql`SELECT value FROM tournament_settings WHERE key = 'awards_visible' LIMIT 1`,
    // Group standings stats — lets the bracket rank the best third-placed teams.
    sql`SELECT team_id, points, played_games, goal_diff, goals_for FROM group_points`,
  ]);

  if (!(auth as unknown[]).length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phase = (phaseRows as { value: string }[])[0]?.value ?? "phase1_open";
  const awardsVisible = (awardsRows as { value: string }[])[0]?.value === "true";
  // Whether THIS player's bracket is frozen by the per-player lock (so the client
  // can render the bracket read-only without attempting saves the API would reject).
  const bracketLocked = await bracketLockedFor(sql, (auth as { id: number }[])[0].id);
  // Scoped, time-boxed re-open of specific knockout stages (e.g. sf/final re-picks).
  // Surface it to the client only while the deadline is still in the future, so the
  // re-pick UI disappears at close even before the cron deletes the setting. The raw
  // setting lives on until the cron's auto-close runs the fallback restore.
  const reopenRaw = await getBracketReopen(sql);
  const reopen = reopenRaw && Date.now() < Date.parse(reopenRaw.until) ? reopenRaw : null;

  return NextResponse.json({ results: rows, phase, awardsVisible, standings, bracketLocked, reopen });
}
