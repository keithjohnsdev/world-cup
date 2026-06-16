import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { type Stat } from "@/lib/stats";

// Returns a stat sheet with any cached LLM headlines attached. Defaults to the
// live snapshot; with ?date=YYYY-MM-DD it returns that day's archived sheet.
// Always includes `archiveDates` (the days the calendar can browse). Never calls
// the LLM (headlines are generated lazily via /api/stats/flavor and cached).
export async function GET(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const auth = await sql`SELECT id FROM users WHERE session_token = ${token}` as { id: number }[];
  if (!auth.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const validDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

  const [archiveRows, flavorRows] = (await Promise.all([
    sql`SELECT to_char(snapshot_date, 'YYYY-MM-DD') AS date FROM stats_archive ORDER BY snapshot_date`,
    sql`SELECT signature, headline FROM stats_flavor`,
  ])) as [{ date: string }[], { signature: string; headline: string }[]];
  const archiveDates = archiveRows.map((r) => r.date);
  const headlineBySig = new Map(flavorRows.map((r) => [r.signature, r.headline]));

  let stats: Stat[] = [];
  let computedAt: string | null = null;
  let date: string | null = null;

  if (validDate) {
    const rows = await sql`
      SELECT data, to_char(snapshot_date, 'YYYY-MM-DD') AS date, computed_at
      FROM stats_archive WHERE snapshot_date = ${validDate}
    ` as { data: Stat[]; date: string; computed_at: string }[];
    if (rows.length) {
      stats = rows[0].data ?? [];
      computedAt = rows[0].computed_at;
      date = rows[0].date;
    }
  } else {
    const rows = await sql`SELECT data, computed_at FROM stats_snapshot WHERE id = 1` as
      { data: Stat[]; computed_at: string }[];
    if (rows.length) {
      stats = rows[0].data ?? [];
      computedAt = rows[0].computed_at;
    }
  }

  const withHeadlines = stats.map((s) => ({ ...s, headline: headlineBySig.get(s.signature) ?? null }));

  return NextResponse.json({ stats: withHeadlines, computedAt, date, archiveDates });
}
