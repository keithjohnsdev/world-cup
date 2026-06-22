import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

// Tracks whether a player has been shown the live practice bracket, so the intro
// spotlight overlay appears once per player (across devices) until acknowledged.

export async function GET(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const rows = (await sql`
    SELECT seen_bracket FROM users WHERE session_token = ${token}
  `) as { seen_bracket: boolean }[];
  if (!rows.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ seen: !!rows[0].seen_bracket });
}

export async function POST(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const rows = (await sql`
    UPDATE users SET seen_bracket = true WHERE session_token = ${token} RETURNING id
  `) as { id: number }[];
  if (!rows.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ ok: true });
}
