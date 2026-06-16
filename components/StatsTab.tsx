"use client";

import { useEffect, useState, useRef } from "react";
import { getTeam } from "@/lib/data";
import { FlagIcon } from "@/components/FlagIcon";

interface Stat {
  key: string;
  category: "tournament" | "pool";
  emoji: string;
  title: string;
  value: string;
  detail?: string;
  explanation?: string;
  teamIds?: string[];
  signature: string;
  headline?: string | null;
}

// World Cup 2026 window — bounds the archive calendar.
const TOURNAMENT_START = "2026-06-11";
const TOURNAMENT_END = "2026-07-19";

const todayStr = () => new Date().toISOString().slice(0, 10);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function StatsTab() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [archiveDates, setArchiveDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // null = today / live
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useState<"johnsies" | "worldcup">("johnsies");
  const [selected, setSelected] = useState<Stat | null>(null);
  const flavorRequested = useRef(false);

  const today = todayStr();

  // Load the selected day's stats (null = live snapshot). Re-runs on date change.
  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    let cancelled = false;
    const url = selectedDate ? `/api/stats?date=${selectedDate}` : "/api/stats";
    fetch(url, { headers: { "x-session-token": token } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setStats(data.stats ?? []);
        setComputedAt(data.computedAt ?? null);
        if (Array.isArray(data.archiveDates)) setArchiveDates(data.archiveDates);
        setError(false);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedDate]);

  // Auto-refresh the LIVE view ~60s while visible (not when browsing the archive).
  useEffect(() => {
    if (selectedDate !== null) return;
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    const reload = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/stats", { headers: { "x-session-token": token } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          setStats(data.stats ?? []);
          setComputedAt(data.computedAt ?? null);
          if (Array.isArray(data.archiveDates)) setArchiveDates(data.archiveDates);
        })
        .catch(() => {});
    };
    const id = setInterval(reload, 60_000);
    document.addEventListener("visibilitychange", reload);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", reload); };
  }, [selectedDate]);

  // Fill in missing LLM headlines once, for the LIVE view only. Archived days
  // show whatever headlines are already cached (templated value otherwise).
  useEffect(() => {
    if (selectedDate !== null || flavorRequested.current) return;
    if (!stats.length || !stats.some((s) => !s.headline)) return;
    flavorRequested.current = true;
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    fetch("/api/stats/flavor", { method: "POST", headers: { "x-session-token": token } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const headlines: Record<string, string> = data.headlines ?? {};
        if (!Object.keys(headlines).length) return;
        setStats((prev) => prev.map((s) => (headlines[s.signature] ? { ...s, headline: headlines[s.signature] } : s)));
      })
      .catch(() => {});
  }, [stats, selectedDate]);

  // Close the detail popup on Escape; lock body scroll while it's open.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [selected]);

  // "Johnsies" = our pool's stats; "World Cup" = the actual tournament records.
  const tournament = stats.filter((s) => s.category === "tournament");
  const pool = stats.filter((s) => s.category === "pool");
  const active = view === "johnsies" ? pool : tournament;
  const showCalendar = !loading && !error && archiveDates.length > 0;

  return (
    <>
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}>
      <div className="px-4 pt-10 pb-16 max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <p className="font-black uppercase leading-none text-white mb-1" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>The</p>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-300/60" />
            <h2 className="font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>Stat Sheet</h2>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-300/60" />
          </div>
          <p className="text-white/40 text-xs mt-3">
            {selectedDate
              ? `Viewing ${formatDay(selectedDate)}`
              : computedAt ? `Updated ${timeAgo(new Date(computedAt))}` : "Surprising records, updated as games finish."}
          </p>
        </div>

        {loading ? (
          <p className="text-center text-white/30 text-sm py-16">Crunching the numbers…</p>
        ) : error ? (
          <p className="text-center text-white/40 text-sm py-16">Couldn&apos;t load the stats right now — try again shortly.</p>
        ) : stats.length === 0 ? (
          <p className="text-center text-white/40 text-sm py-16 rounded-2xl border border-white/10">
            {selectedDate ? "No stat sheet was saved for this day." : "The stat sheet fills up once the first games are played."}
          </p>
        ) : (
          <>
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-1 rounded-full bg-black/30 p-1 backdrop-blur-sm">
                {([["johnsies", "Johnsies"], ["worldcup", "World Cup"]] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.12em] transition-all cursor-pointer ${
                      view === v ? "bg-yellow-300 text-green-950" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {active.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {active.map((s) => <StatCard key={s.key} stat={s} onSelect={setSelected} />)}
              </div>
            ) : (
              <p className="text-center text-white/40 text-sm py-10">
                {view === "johnsies" ? "Pool stats appear as picks meet results." : "Tournament records fill up as games are played."}
              </p>
            )}
          </>
        )}

        {showCalendar && (
          <StatsCalendar
            archiveDates={archiveDates}
            selectedDate={selectedDate}
            today={today}
            onSelect={setSelectedDate}
          />
        )}
      </div>
    </div>

    {selected && <StatModal stat={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function StatsCalendar({ archiveDates, selectedDate, today, onSelect }: {
  archiveDates: string[];
  selectedDate: string | null;
  today: string;
  onSelect: (date: string | null) => void;
}) {
  const available = new Set(archiveDates);
  available.add(today); // today is always browsable (the live sheet)

  const initial = selectedDate ?? today;
  const [ym, setYm] = useState(() => {
    const d = new Date(`${initial}T12:00:00Z`);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });

  const startD = new Date(`${TOURNAMENT_START}T12:00:00Z`);
  const endD = new Date(`${TOURNAMENT_END}T12:00:00Z`);
  const minYM = startD.getUTCFullYear() * 12 + startD.getUTCMonth();
  const maxYM = endD.getUTCFullYear() * 12 + endD.getUTCMonth();
  const curYM = ym.y * 12 + ym.m;

  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(ymd(new Date(Date.UTC(ym.y, ym.m, day))));

  const inWindow = (ds: string) => ds >= TOURNAMENT_START && ds <= TOURNAMENT_END;

  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-4 max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-3">
        <button
          aria-label="Previous month"
          disabled={curYM <= minYM}
          onClick={() => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}
          className="text-white/50 hover:text-white disabled:opacity-20 disabled:cursor-default cursor-pointer p-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="text-xs font-black uppercase tracking-[0.15em] text-white/70">{monthLabel}</span>
        <button
          aria-label="Next month"
          disabled={curYM >= maxYM}
          onClick={() => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}
          className="text-white/50 hover:text-white disabled:opacity-20 disabled:cursor-default cursor-pointer p-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-black text-white/30">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((ds, i) => {
          if (!ds) return <div key={i} />;
          const dayNum = Number(ds.slice(8, 10));
          const isAvail = inWindow(ds) && available.has(ds);
          const isToday = ds === today;
          const isSelected = selectedDate === ds || (selectedDate === null && isToday);
          return (
            <button
              key={i}
              disabled={!isAvail}
              onClick={() => onSelect(isToday ? null : ds)}
              className={`relative aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${
                isSelected
                  ? "bg-yellow-300 text-green-950"
                  : isAvail
                    ? "text-white hover:bg-white/10 cursor-pointer"
                    : inWindow(ds) ? "text-white/25" : "text-white/10"
              } ${isToday && !isSelected ? "ring-1 ring-yellow-300/50" : ""}`}
            >
              {dayNum}
              {isAvail && !isSelected && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-yellow-300/70" />}
            </button>
          );
        })}
      </div>
      <p className="text-center text-white/30 text-[10px] mt-3">Tap a highlighted day to see that day&apos;s stat sheet</p>
    </div>
  );
}

function StatModal({ stat, onClose }: { stat: Stat; onClose: () => void }) {
  const teams = (stat.teamIds ?? []).map((id) => getTeam(id)).filter(Boolean);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0b1c30] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{stat.emoji}</span>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-green-400">{stat.title}</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-white/50 hover:text-white transition-colors -mt-1 -mr-1 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {stat.headline && <p className="text-yellow-300 font-bold leading-snug mb-1">{stat.headline}</p>}
        <p className="text-white font-bold text-lg leading-snug">{stat.value}</p>
        {stat.detail && <p className="text-white/50 text-sm mt-0.5">{stat.detail}</p>}
        {teams.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            {teams.map((t) => t && (
              <span key={t.id} className="flex items-center gap-1.5">
                <FlagIcon cc={t.cc} name={t.name} className="w-7 h-5" />
                <span className="text-white/70 text-sm">{t.name}</span>
              </span>
            ))}
          </div>
        )}
        {stat.explanation && (
          <>
            <div className="h-px bg-white/10 my-4" />
            <p className="text-white/70 text-sm leading-relaxed">{stat.explanation}</p>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ stat, onSelect }: { stat: Stat; onSelect: (s: Stat) => void }) {
  const teams = (stat.teamIds ?? []).map((id) => getTeam(id)).filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => onSelect(stat)}
      className="text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-white/20 transition-colors p-4 flex flex-col gap-1.5 cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{stat.emoji}</span>
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-green-400">{stat.title}</span>
      </div>
      {stat.headline && (
        <p className="text-yellow-300 font-bold text-sm leading-snug">{stat.headline}</p>
      )}
      <p className={`text-white leading-snug ${stat.headline ? "text-sm text-white/70" : "font-bold"}`}>{stat.value}</p>
      {stat.detail && <p className="text-white/45 text-xs leading-snug">{stat.detail}</p>}
      {teams.length > 0 && (
        <div className="flex items-center gap-1.5 mt-1">
          {teams.map((t) => t && <FlagIcon key={t.id} cc={t.cc} name={t.name} className="w-6 h-4" />)}
        </div>
      )}
    </button>
  );
}

function formatDay(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function timeAgo(d: Date) {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
