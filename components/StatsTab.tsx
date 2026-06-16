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

export function StatsTab() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useState<"johnsies" | "worldcup">("johnsies");
  const [selected, setSelected] = useState<Stat | null>(null);
  const flavorRequested = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    if (!token) return;

    const load = () => {
      fetch("/api/stats", { headers: { "x-session-token": token } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          setStats(data.stats ?? []);
          setComputedAt(data.computedAt ?? null);
          setError(false);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    };
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  // After stats land, ask the server to fill in any missing LLM headlines once.
  useEffect(() => {
    if (flavorRequested.current) return;
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
  }, [stats]);

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
            {computedAt ? `Updated ${timeAgo(new Date(computedAt))}` : "Surprising records, updated as games finish."}
          </p>
        </div>

        {loading ? (
          <p className="text-center text-white/30 text-sm py-16">Crunching the numbers…</p>
        ) : error ? (
          <p className="text-center text-white/40 text-sm py-16">Couldn&apos;t load the stats right now — try again shortly.</p>
        ) : stats.length === 0 ? (
          <p className="text-center text-white/40 text-sm py-16 rounded-2xl border border-white/10">
            The stat sheet fills up once the first games are played.
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
      </div>
    </div>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  const teams = (stat.teamIds ?? []).map((id) => getTeam(id)).filter(Boolean);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-1.5">
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
    </div>
  );
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
