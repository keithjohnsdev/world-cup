"use client";

import { useCallback, useEffect, useState } from "react";

interface Message {
  id: number;
  user_id: number | null;
  user_name: string;
  body: string;
  is_announcer: boolean;
  created_at: string;
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
            {messages.map((m) => {
              const mine = me != null && m.user_id === me.id;
              const announcer = m.is_announcer;
              const color = nameColor(m.user_name);
              return (
                <div
                  key={m.id}
                  className={`group flex gap-3 rounded-2xl border p-4 ${
                    announcer
                      ? "border-amber-400/40 bg-gradient-to-r from-amber-400/[0.12] to-amber-400/[0.04]"
                      : mine
                        ? "border-yellow-300/25 bg-yellow-300/[0.06]"
                        : "border-white/10 bg-white/5"
                  }`}
                >
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-[11px] font-black text-green-950"
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
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${announcer ? "text-amber-50/90 font-medium" : "text-white/85"}`}>{renderWithFlags(m.body)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
