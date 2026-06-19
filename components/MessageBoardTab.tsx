"use client";

import { useCallback, useEffect, useState } from "react";
import { REACTIONS } from "@/lib/reactions";

interface ReactionAgg {
  emoji: string;
  count: number;
  mine: boolean;
}

interface Message {
  id: number;
  user_id: number | null;
  user_name: string;
  body: string;
  is_announcer: boolean;
  parent_id: number | null;
  created_at: string;
  reactions: ReactionAgg[];
  replies?: Message[];
}

interface Me {
  id: number;
  name: string;
  isAdmin: boolean;
}

const MAX_BODY = 1000;

function relativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// A stable, pleasant colour per author so names are easy to tell apart at a glance.
const NAME_COLORS = ["#fbbf24", "#4ade80", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf", "#f87171"];
function nameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

// Windows has no glyphs for flag emoji, so a posted 🇲🇦 falls back to the bare
// letters "MA" while iPhones show the flag. To render flags everywhere, we swap
// flag emoji for the same flagcdn images the rest of the app uses (see FlagIcon),
// leaving all other text and emoji untouched so native rendering is preserved.
// Matches regional-indicator pairs (🇲🇦) and tag-sequence subdivision flags (🏴󠁧󠁢󠁳󠁣󠁴󠁿).
const FLAG_RE = /\u{1F3F4}[\u{E0061}-\u{E007A}]+\u{E007F}|[\u{1F1E6}-\u{1F1FF}]{2}/gu;

// Turn a matched flag emoji into a flagcdn 2-letter (or subdivision) country code.
function flagCc(seq: string): string {
  const cps = [...seq].map((c) => c.codePointAt(0)!);
  if (cps[0] === 0x1f3f4) {
    // Tag sequence: black flag + tag letters + cancel. e.g. gb + sct → "gb-sct".
    const letters = cps
      .slice(1, -1)
      .map((cp) => String.fromCharCode(cp - 0xe0061 + 97))
      .join("");
    return letters.length > 2 ? `${letters.slice(0, 2)}-${letters.slice(2)}` : letters;
  }
  // Regional-indicator pair: each codepoint maps to a letter A–Z.
  return cps.map((cp) => String.fromCharCode(cp - 0x1f1e6 + 97)).join("");
}

function renderWithFlags(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(FLAG_RE)) {
    const start = m.index!;
    if (start > last) nodes.push(text.slice(last, start));
    const cc = flagCc(m[0]);
    nodes.push(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`f${key++}`}
        src={`https://flagcdn.com/w40/${cc}.png`}
        srcSet={`https://flagcdn.com/w80/${cc}.png 2x`}
        alt={m[0]}
        className="inline-block h-[1em] w-auto align-[-0.15em] rounded-[2px] mx-[0.06em]"
      />,
    );
    last = start + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Optimistic local toggle of one emoji on a reaction list, mirroring the server's
// add/remove semantics so the chip updates instantly; the next response reconciles.
function toggleReaction(list: ReactionAgg[], emoji: string): ReactionAgg[] {
  const existing = list.find((r) => r.emoji === emoji);
  let next: ReactionAgg[];
  if (!existing) {
    next = [...list, { emoji, count: 1, mine: true }];
  } else if (existing.mine) {
    const count = existing.count - 1;
    next =
      count <= 0
        ? list.filter((r) => r.emoji !== emoji)
        : list.map((r) => (r.emoji === emoji ? { ...r, count, mine: false } : r));
  } else {
    next = list.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
  }
  const order = (e: string) => {
    const i = (REACTIONS as readonly string[]).indexOf(e);
    return i === -1 ? REACTIONS.length : i;
  };
  return next.sort((a, b) => order(a.emoji) - order(b.emoji));
}

export function MessageBoardTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [, setNow] = useState(0); // ticks so relative times stay live

  const fetchMessages = useCallback(() => {
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    fetch("/api/messages", { headers: { "x-session-token": token } })
      .then((r) => r.json())
      .then((data: { messages?: Message[]; me?: Me }) => {
        if (Array.isArray(data.messages)) setMessages(data.messages);
        if (data.me) setMe(data.me);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMessages();
    // Refresh ~20s while the tab is visible; pause when hidden, refetch on return.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchMessages();
    }, 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchMessages(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [fetchMessages]);

  // Re-render every 30s so the "… ago" labels keep counting up.
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Apply an update to one message wherever it lives — a top-level post or a reply.
  const updateMessage = useCallback((id: number, fn: (m: Message) => Message) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === id) return fn(m);
        if (m.replies?.some((r) => r.id === id)) {
          return { ...m, replies: m.replies.map((r) => (r.id === id ? fn(r) : r)) };
        }
        return m;
      }),
    );
  }, []);

  const react = useCallback(
    (id: number, emoji: string) => {
      const token = localStorage.getItem("wc_token");
      if (!token) return;
      updateMessage(id, (m) => ({ ...m, reactions: toggleReaction(m.reactions, emoji) }));
      fetch("/api/messages/react", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ message_id: id, emoji }),
      })
        .then((r) => r.json())
        .then((data: { reactions?: ReactionAgg[] }) => {
          if (Array.isArray(data.reactions)) {
            updateMessage(id, (m) => ({ ...m, reactions: data.reactions! }));
          }
        })
        .catch(() => { /* the next poll reconciles */ });
    },
    [updateMessage],
  );

  const reply = useCallback(async (parentId: number, text: string): Promise<boolean> => {
    const token = localStorage.getItem("wc_token");
    if (!token) return false;
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ body: text, parent_id: parentId }),
      });
      const data: { message?: Message } = await r.json();
      if (r.ok && data.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === parentId ? { ...m, replies: [...(m.replies ?? []), data.message!] } : m,
          ),
        );
        return true;
      }
    } catch {
      /* swallow — caller keeps the draft so nothing is lost */
    }
    return false;
  }, []);

  async function post() {
    const text = draft.trim();
    if (!text || posting) return;
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    setPosting(true);
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ body: text }),
      });
      const data: { message?: Message } = await r.json();
      if (r.ok && data.message) {
        setMessages((prev) => [data.message!, ...prev]);
        setDraft("");
      }
    } catch {
      /* leave the draft in place so nothing is lost */
    } finally {
      setPosting(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter posts; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      post();
    }
  }

  const remaining = MAX_BODY - draft.length;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}>
      <div className="px-4 pt-10 pb-16 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-300/60" />
            <h2 className="font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(2rem, 6vw, 2.75rem)", letterSpacing: "-0.02em" }}>
              The Board
            </h2>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-300/60" />
          </div>
          <p className="text-white/60 text-sm mt-3">
            Trash talk, hot takes, and bracket regrets — say it here for the whole family.
          </p>
        </div>

        {/* Composer */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mb-8">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_BODY))}
            onKeyDown={onKeyDown}
            placeholder={me ? `Say something, ${me.name.split(/\s+/)[0]}…` : "Say something…"}
            rows={2}
            className="w-full resize-none bg-transparent text-white text-sm placeholder:text-white/40 focus:outline-none px-2 py-1.5 leading-relaxed"
          />
          <div className="flex items-center justify-between gap-3 mt-1 pl-2">
            <span className={`text-[11px] tabular-nums ${remaining < 50 ? "text-red-400" : "text-white/30"}`}>
              {remaining < 100 ? `${remaining} left` : ""}
            </span>
            <button
              onClick={post}
              disabled={!draft.trim() || posting}
              className="rounded-full bg-yellow-300 text-green-950 text-xs font-black uppercase tracking-[0.1em] px-5 py-2 transition-all enabled:hover:bg-yellow-200 enabled:cursor-pointer disabled:opacity-40"
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>

        {/* Feed */}
        {loading ? (
          <p className="text-center text-white/50 text-sm py-16">Loading the board…</p>
        ) : error && messages.length === 0 ? (
          <p className="text-center text-white/50 text-sm py-16">Couldn&apos;t load the board right now. Try again shortly.</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-white/50 text-sm">No messages yet — be the first to say something.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <MessageCard key={m.id} m={m} me={me} isReply={false} onReact={react} onReply={reply} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageCard({
  m,
  me,
  isReply,
  onReact,
  onReply,
}: {
  m: Message;
  me: Me | null;
  isReply: boolean;
  onReact: (id: number, emoji: string) => void;
  onReply: (parentId: number, text: string) => Promise<boolean>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const mine = me != null && m.user_id === me.id;
  const announcer = m.is_announcer;
  const color = nameColor(m.user_name);
  const replies = m.replies ?? [];
  const COLLAPSE_AT = 3;
  const visibleReplies = expanded || replies.length <= COLLAPSE_AT ? replies : replies.slice(0, COLLAPSE_AT);

  async function sendReply() {
    const text = replyDraft.trim();
    if (!text || replyPosting) return;
    setReplyPosting(true);
    const ok = await onReply(m.id, text);
    setReplyPosting(false);
    if (ok) { setReplyDraft(""); setReplyOpen(false); }
  }

  function onReplyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  }

  const cardClass = isReply
    ? "rounded-xl bg-white/[0.03] p-3"
    : `rounded-2xl border p-4 ${
        announcer
          ? "border-amber-400/40 bg-gradient-to-r from-amber-400/[0.12] to-amber-400/[0.04]"
          : mine
            ? "border-yellow-300/25 bg-yellow-300/[0.06]"
            : "border-white/10 bg-white/5"
      }`;
  const avatarSize = isReply ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-[11px]";

  return (
    <div className={cardClass}>
      <div className="flex gap-3">
        <div
          className={`flex items-center justify-center rounded-full shrink-0 font-black text-green-950 ${avatarSize}`}
          style={{ background: announcer ? "#f59e0b" : color }}
          aria-hidden
        >
          {announcer ? <span className="text-base leading-none">📣</span> : initials(m.user_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-black text-sm truncate" style={{ color: announcer ? "#fbbf24" : color }}>
              {m.user_name}
            </span>
            {announcer ? (
              <span className="text-[10px] font-black uppercase tracking-wide text-amber-300/80 bg-amber-400/10 rounded-full px-1.5 py-0.5">
                Announcer
              </span>
            ) : mine ? (
              <span className="text-[10px] font-black uppercase tracking-wide text-yellow-300/70">You</span>
            ) : null}
            <span className="text-white/30 text-[11px] shrink-0 ml-auto">{relativeTime(m.created_at)}</span>
          </div>
          <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${announcer ? "text-amber-50/90 font-medium" : "text-white/85"}`}>
            {renderWithFlags(m.body)}
          </p>

          {/* Reactions + actions */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(m.id, r.emoji)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors cursor-pointer ${
                  r.mine
                    ? "border-yellow-300/40 bg-yellow-300/15 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                <span>{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}

            <div className="relative">
              <button
                onClick={() => setPickerOpen((o) => !o)}
                aria-label="Add reaction"
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/45 hover:bg-white/10 hover:text-white/70 transition-colors cursor-pointer"
              >
                <span className="leading-none">🙂</span>
                <span className="leading-none ml-0.5">＋</span>
              </button>
              {pickerOpen && (
                <div className="absolute z-10 bottom-full left-0 mb-1 flex gap-1.5 rounded-full border border-white/15 bg-[#0d2137] px-2.5 py-1.5 shadow-lg shadow-black/40">
                  {REACTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => { onReact(m.id, e); setPickerOpen(false); }}
                      className="text-lg leading-none transition-transform hover:scale-125 cursor-pointer"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!isReply && (
              <button
                onClick={() => setReplyOpen((o) => !o)}
                className="text-[11px] font-semibold uppercase tracking-wide text-white/40 hover:text-white/70 px-1 transition-colors cursor-pointer"
              >
                Reply
              </button>
            )}
          </div>

          {/* Reply composer */}
          {!isReply && replyOpen && (
            <div className="mt-2 flex items-end gap-2">
              <textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value.slice(0, MAX_BODY))}
                onKeyDown={onReplyKeyDown}
                placeholder={`Reply to ${m.user_name.split(/\s+/)[0]}…`}
                rows={1}
                autoFocus
                className="flex-1 resize-none rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white/20 px-2.5 py-1.5 leading-relaxed"
              />
              <button
                onClick={sendReply}
                disabled={!replyDraft.trim() || replyPosting}
                className="rounded-full bg-yellow-300 text-green-950 text-xs font-black uppercase tracking-[0.08em] px-4 py-2 transition-all enabled:hover:bg-yellow-200 enabled:cursor-pointer disabled:opacity-40 shrink-0"
              >
                {replyPosting ? "…" : "Reply"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Replies thread */}
      {!isReply && replies.length > 0 && (
        <div className="mt-3 ml-6 space-y-2 border-l border-white/10 pl-3">
          {visibleReplies.map((r) => (
            <MessageCard key={r.id} m={r} me={me} isReply onReact={onReact} onReply={onReply} />
          ))}
          {replies.length > COLLAPSE_AT && (
            <button
              onClick={() => setExpanded((x) => !x)}
              className="text-[11px] font-semibold text-yellow-300/70 hover:text-yellow-200 px-1 cursor-pointer"
            >
              {expanded ? "Show fewer" : `Show all ${replies.length} replies`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
