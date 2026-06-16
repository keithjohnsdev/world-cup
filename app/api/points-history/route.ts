import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

// Returns the cumulative points-by-game series for every player, read straight
// from points_history (already materialised by rebuildPointsHistory — no scoring
// happens here). Powers the line graph below the leaderboard.
export async function GET(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const auth = await sql`SELECT id FROM users WHERE session_token = ${token}` as { id: number }[];
  if (!auth.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT ph.user_id, u.name, u.is_kid, ph.game_index, ph.label, ph.match_utc, ph.total
    FROM points_history ph
    JOIN users u ON u.id = ph.user_id
    ORDER BY ph.game_index, u.name
  ` as {
    user_id: number; name: string; is_kid: boolean;
    game_index: number; label: string; match_utc: string; total: number;
  }[];

  // Distinct games (X-axis), in order.
  const gamesMap = new Map<number, { index: number; label: string; utc: string }>();
  for (const r of rows) {
    if (!gamesMap.has(r.game_index)) {
      gamesMap.set(r.game_index, { index: r.game_index, label: r.label, utc: r.match_utc });
    }
  }
  const games = [...gamesMap.values()].sort((a, b) => a.index - b.index);

  // One series per player.
  const playersMap = new Map<number, { id: number; name: string; is_kid: boolean; points: { index: number; total: number }[] }>();
  for (const r of rows) {
    let p = playersMap.get(r.user_id);
    if (!p) {
      p = { id: r.user_id, name: r.name, is_kid: r.is_kid, points: [] };
      playersMap.set(r.user_id, p);
    }
    p.points.push({ index: r.game_index, total: r.total });
  }

  // Order players by their latest total (desc) so the legend matches the leaderboard.
  const players = [...playersMap.values()].sort((a, b) => {
    const at = a.points[a.points.length - 1]?.total ?? 0;
    const bt = b.points[b.points.length - 1]?.total ?? 0;
    return bt - at || a.name.localeCompare(b.name);
  });

  return NextResponse.json({ games, players });
}
