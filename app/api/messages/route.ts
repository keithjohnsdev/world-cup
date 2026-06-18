import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

const MAX_BODY = 1000; // characters per message
const FETCH_LIMIT = 200; // most recent messages returned

type MessageRow = {
  id: number;
  user_id: number | null;
  user_name: string;
  body: string;
  is_announcer: boolean;
  created_at: string;
};

async function getUser(req: NextRequest) {
  const token = req.headers.get("x-session-token");
  if (!token) return null;
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name FROM users WHERE session_token = ${token}
  `) as { id: number; name: string }[];
  return rows[0] ?? null;
}

// Keith is the pool admin (mirrors the client-side check in app/page.tsx) and can
// delete anyone's message; everyone else can only delete their own.
function isAdmin(name: string) {
  return name.toLowerCase() === "keith";
}

export async function GET(req: NextRequest) {
  await initDb();
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const rows = (await sql`
    SELECT id, user_id, user_name, body, is_announcer, created_at
    FROM messages
    ORDER BY created_at DESC, id DESC
    LIMIT ${FETCH_LIMIT}
  `) as MessageRow[];

  return NextResponse.json({
    messages: rows,
    me: { id: user.id, name: user.name, isAdmin: isAdmin(user.name) },
  });
}

export async function POST(req: NextRequest) {
  await initDb();
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body } = await req.json();
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `Message too long (max ${MAX_BODY})` }, { status: 400 });
  }

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO messages (user_id, user_name, body)
    VALUES (${user.id}, ${user.name}, ${text})
    RETURNING id, user_id, user_name, body, is_announcer, created_at
  `) as MessageRow[];

  return NextResponse.json({ message: rows[0] });
}
