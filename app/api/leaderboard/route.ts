import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const auth = await sql`SELECT id FROM users WHERE session_token = ${token}` as { id: number }[];
  if (!auth.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await sql`
    SELECT
      u.id,
      u.name,
      u.is_kid,
      0 AS group_score,
      0 AS bracket_score,
      0 AS total_score
    FROM users u
    ORDER BY u.name ASC
  `;

  return NextResponse.json(entries);
}
