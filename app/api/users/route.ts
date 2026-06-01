import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { randomBytes } from "crypto";

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

    if (existing.length) return NextResponse.json(existing[0]);

    const token = randomBytes(32).toString("hex");
    const rows = (await sql`
      INSERT INTO users (name, session_token) VALUES (${trimmed}, ${token})
      RETURNING id, name, session_token
    `) as { id: number; name: string; session_token: string }[];
    return NextResponse.json(rows[0]);
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
