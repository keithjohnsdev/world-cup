import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

// Tracks whether a player has been shown the new Message Board tab, so the intro
// spotlight overlay appears once per player (across devices) until acknowledged.

export async function GET(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const rows = (await sql`
    SELECT seen_board FROM users WHERE session_token = ${token}
  `) as { seen_board: boolean }[];
  if (!rows.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ seen: !!rows[0].seen_board });
}

export async function POST(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const rows = (await sql`
    UPDATE users SET seen_board = true WHERE session_token = ${token} RETURNING id
  `) as { id: number }[];
  if (!rows.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ ok: true });
}
