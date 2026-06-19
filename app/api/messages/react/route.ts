import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { REACTIONS, isReaction } from "@/lib/reactions";

type ReactionAgg = { emoji: string; count: number; mine: boolean };

async function getUser(req: NextRequest) {
  const token = req.headers.get("x-session-token");
  if (!token) return null;
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name FROM users WHERE session_token = ${token}
  `) as { id: number; name: string }[];
  return rows[0] ?? null;
}

// Toggle one emoji reaction on a message for the current user: remove it if it's
// already there, otherwise add it. Returns the message's full, fresh reaction list.
export async function POST(req: NextRequest) {
  await initDb();
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message_id, emoji } = await req.json();
  if (typeof message_id !== "number" || !Number.isInteger(message_id)) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }
  if (!isReaction(emoji)) {
    return NextResponse.json({ error: "Unsupported reaction" }, { status: 400 });
  }

  const sql = getSql();

  const exists = (await sql`SELECT 1 FROM messages WHERE id = ${message_id}`) as unknown[];
  if (exists.length === 0) {
    return NextResponse.json({ error: "Message not found" }, { status: 400 });
  }

  // Toggle: delete first; if nothing was removed, the user hadn't reacted, so add it.
  const removed = (await sql`
    DELETE FROM message_reactions
    WHERE message_id = ${message_id} AND user_id = ${user.id} AND emoji = ${emoji}
    RETURNING 1
  `) as unknown[];
  if (removed.length === 0) {
    await sql`
      INSERT INTO message_reactions (message_id, user_id, emoji)
      VALUES (${message_id}, ${user.id}, ${emoji})
      ON CONFLICT DO NOTHING
    `;
  }

  // Fresh aggregate for just this message, ordered by the fixed palette.
  const rows = (await sql`
    SELECT emoji, COUNT(*)::int AS count, BOOL_OR(user_id = ${user.id}) AS mine
    FROM message_reactions
    WHERE message_id = ${message_id}
    GROUP BY emoji
  `) as { emoji: string; count: number; mine: boolean }[];

  const order = (e: string) => {
    const i = (REACTIONS as readonly string[]).indexOf(e);
    return i === -1 ? REACTIONS.length : i;
  };
  const reactions: ReactionAgg[] = rows
    .map((r) => ({ emoji: r.emoji, count: r.count, mine: r.mine }))
    .sort((a, b) => order(a.emoji) - order(b.emoji));

  return NextResponse.json({ message_id, reactions });
}
