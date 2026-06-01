import { NextRequest, NextResponse } from "next/server";
import { sql, initDb } from "@/lib/db";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await initDb();
  const token = randomBytes(32).toString("hex");
  const rows = await sql`
    INSERT INTO users (name, session_token) VALUES (${name.trim()}, ${token})
    RETURNING id, name, session_token
  `;
  return NextResponse.json(rows[0]);
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  await initDb();
  const rows = await sql`SELECT id, name FROM users WHERE session_token = ${token}`;
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}
