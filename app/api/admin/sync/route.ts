import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { runResultsSync } from "@/lib/run-results-sync";

async function requireKeith(req: NextRequest) {
  const token = req.headers.get("x-session-token");
  if (!token) return null;
  const sql = getSql();
  const rows = await sql`SELECT name FROM users WHERE session_token = ${token}` as { name: string }[];
  if (!rows[0] || rows[0].name.toLowerCase() !== "keith") return null;
  return true;
}

export const dynamic = "force-dynamic";

// POST — manually run the same results-sync the cron job performs.
export async function POST(req: NextRequest) {
  await initDb();
  const ok = await requireKeith(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await runResultsSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/sync] sync failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
