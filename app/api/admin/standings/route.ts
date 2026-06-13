// Admin: backfill / refresh live group points on demand, without waiting for the
// next cron run. Pulls the current football-data.org standings and upserts
// group_points for every team. Safe to call repeatedly.

import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { syncGroupPoints } from "@/lib/sync-standings";

async function requireKeith(req: NextRequest) {
  const token = req.headers.get("x-session-token");
  if (!token) return null;
  const sql = getSql();
  const rows = await sql`SELECT name FROM users WHERE session_token = ${token}` as { name: string }[];
  if (!rows[0] || rows[0].name.toLowerCase() !== "keith") return null;
  return true;
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await initDb();
  const ok = await requireKeith(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { updated } = await syncGroupPoints(getSql());
    return NextResponse.json({ ok: true, updated });
  } catch (err) {
    console.error("[admin/standings] sync failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
