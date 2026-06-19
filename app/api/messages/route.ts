import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { REACTIONS } from "@/lib/reactions";

const MAX_BODY = 1000; // characters per message
const FETCH_LIMIT = 200; // most recent top-level messages returned

type MessageRow = {
  id: number;
  user_id: number | null;
  user_name: string;
  body: string;
  is_announcer: boolean;
  parent_id: number | null;
  created_at: string;
};

type ReactionAgg = { emoji: string; count: number; mine: boolean };
type Message = MessageRow & { reactions: ReactionAgg[]; replies?: Message[] };

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

// Build a message_id → reactions[] map for the given ids, from the current user's
// perspective (so each emoji carries whether *they* reacted). Reactions are ordered
// by the fixed palette for stable display.
async function reactionsByMessage(
  ids: number[],
  meId: number,
): Promise<Map<number, ReactionAgg[]>> {
  const map = new Map<number, ReactionAgg[]>();
  if (ids.length === 0) return map;
  const sql = getSql();
  const rows = (await sql`
    SELECT message_id, emoji, COUNT(*)::int AS count,
           BOOL_OR(user_id = ${meId}) AS mine
    FROM message_reactions
    WHERE message_id = ANY(${ids})
    GROUP BY message_id, emoji
  `) as { message_id: number; emoji: string; count: number; mine: boolean }[];

  for (const r of rows) {
    if (!map.has(r.message_id)) map.set(r.message_id, []);
    map.get(r.message_id)!.push({ emoji: r.emoji, count: r.count, mine: r.mine });
  }
  const order = (e: string) => {
    const i = (REACTIONS as readonly string[]).indexOf(e);
    return i === -1 ? REACTIONS.length : i;
  };
  for (const list of map.values()) list.sort((a, b) => order(a.emoji) - order(b.emoji));
  return map;
}

export async function GET(req: NextRequest) {
  await initDb();
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();

  // Top-level posts only (newest first) — replies are nested under them below.
  const top = (await sql`
    SELECT id, user_id, user_name, body, is_announcer, parent_id, created_at
    FROM messages
    WHERE parent_id IS NULL
    ORDER BY created_at DESC, id DESC
    LIMIT ${FETCH_LIMIT}
  `) as MessageRow[];

  const parentIds = top.map((m) => m.id);

  // Replies to those posts, oldest-first so each thread reads as a conversation.
  const replies =
    parentIds.length === 0
      ? []
      : ((await sql`
          SELECT id, user_id, user_name, body, is_announcer, parent_id, created_at
          FROM messages
          WHERE parent_id = ANY(${parentIds})
          ORDER BY created_at ASC, id ASC
        `) as MessageRow[]);

  const reactions = await reactionsByMessage(
    [...parentIds, ...replies.map((r) => r.id)],
    user.id,
  );
  const enrich = (m: MessageRow): Message => ({ ...m, reactions: reactions.get(m.id) ?? [] });

  const repliesByParent = new Map<number, Message[]>();
  for (const r of replies) {
    if (!repliesByParent.has(r.parent_id!)) repliesByParent.set(r.parent_id!, []);
    repliesByParent.get(r.parent_id!)!.push(enrich(r));
  }

  const messages: Message[] = top.map((m) => ({
    ...enrich(m),
    replies: repliesByParent.get(m.id) ?? [],
  }));

  return NextResponse.json({
    messages,
    me: { id: user.id, name: user.name, isAdmin: isAdmin(user.name) },
  });
}

export async function POST(req: NextRequest) {
  await initDb();
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body, parent_id } = await req.json();
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `Message too long (max ${MAX_BODY})` }, { status: 400 });
  }

  const sql = getSql();

  // A reply must point at an existing *top-level* message — replies are one level deep.
  let parentId: number | null = null;
  if (parent_id != null) {
    if (typeof parent_id !== "number" || !Number.isInteger(parent_id)) {
      return NextResponse.json({ error: "Invalid parent" }, { status: 400 });
    }
    const parent = (await sql`
      SELECT parent_id FROM messages WHERE id = ${parent_id}
    `) as { parent_id: number | null }[];
    if (parent.length === 0) {
      return NextResponse.json({ error: "Parent message not found" }, { status: 400 });
    }
    if (parent[0].parent_id != null) {
      return NextResponse.json({ error: "Cannot reply to a reply" }, { status: 400 });
    }
    parentId = parent_id;
  }

  const rows = (await sql`
    INSERT INTO messages (user_id, user_name, body, parent_id)
    VALUES (${user.id}, ${user.name}, ${text}, ${parentId})
    RETURNING id, user_id, user_name, body, is_announcer, parent_id, created_at
  `) as MessageRow[];

  const message: Message = { ...rows[0], reactions: [], replies: [] };
  return NextResponse.json({ message });
}
