import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    await initDb();
    const sql = getSql();
    const trimmed = name.trim();

    const existing = (await sql`
      SELECT id, name, session_token FROM users WHERE LOWER(name) = LOWER(${trimmed})
    `) as { id: number; name: string; session_token: string }[];

    if (existing.length) return NextResponse.json({ ...existing[0], is_new: false });

    // Signups are locked now that the tournament has started: only existing
    // players (case-insensitive name match above) may sign in. No new accounts.
    return NextResponse.json(
      { error: "no current player with this name, try again" },
      { status: 403 }
    );
  } catch (err) {
    console.error("[POST /api/users]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  await initDb();
  const sql = getSql();
  const rows = (await sql`SELECT id, name FROM users WHERE session_token = ${token}`) as { id: number; name: string }[];
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}
