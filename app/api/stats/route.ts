import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { type Stat } from "@/lib/stats";

// Returns the materialised stats snapshot with any cached LLM headlines attached.
// Always fast — never calls the LLM (headlines are generated lazily via
// /api/stats/flavor and cached in stats_flavor).
export async function GET(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const auth = await sql`SELECT id FROM users WHERE session_token = ${token}` as { id: number }[];
  if (!auth.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapRows = await sql`SELECT data, computed_at FROM stats_snapshot WHERE id = 1` as
    { data: Stat[]; computed_at: string }[];

  if (!snapRows.length) return NextResponse.json({ stats: [], computedAt: null });

  const stats = snapRows[0].data ?? [];
  const flavorRows = await sql`SELECT signature, headline FROM stats_flavor` as
    { signature: string; headline: string }[];
  const headlineBySig = new Map(flavorRows.map((r) => [r.signature, r.headline]));

  const withHeadlines = stats.map((s) => ({ ...s, headline: headlineBySig.get(s.signature) ?? null }));

  return NextResponse.json({ stats: withHeadlines, computedAt: snapRows[0].computed_at });
}
