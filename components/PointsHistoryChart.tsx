"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface Game { index: number; label: string; utc: string }
interface Player { id: number; name: string; is_kid: boolean; points: { index: number; total: number }[] }

// Distinct, high-contrast palette that reads on the dark leaderboard background.
const COLORS = [
  "#fde047", "#60a5fa", "#f87171", "#4ade80", "#c084fc", "#fb923c",
  "#22d3ee", "#f472b6", "#a3e635", "#818cf8", "#fbbf24", "#2dd4bf",
  "#e879f9", "#34d399", "#fca5a5", "#93c5fd",
];

export function PointsHistoryChart() {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    const load = () => {
      fetch("/api/points-history", { headers: { "x-session-token": token } })
        .then((r) => r.json())
        .then((data) => {
          if (data?.games) setGames(data.games);
          if (data?.players) setPlayers(data.players);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    // Refresh on the same cadence as the leaderboard while visible.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  // Close the expanded view on Escape; lock body scroll while it's open.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [expanded]);

  if (loading) return null;

  if (games.length === 0 || players.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-16 -mt-8">
        <SectionHeading />
        <p className="text-white/30 text-sm text-center py-10 rounded-2xl border border-white/10">
          The race chart appears once the first games are played.
        </p>
      </div>
    );
  }

  const labelByIndex = new Map(games.map((g) => [g.index, g.label]));

  // One row per game; each player is a column keyed by `p<id>`.
  const data = games.map((g) => {
    const row: Record<string, number | string> = { index: g.index };
    for (const p of players) {
      const pt = p.points.find((x) => x.index === g.index);
      if (pt) row[`p${p.id}`] = pt.total;
    }
    return row;
  });

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 pb-16 -mt-8">
        <SectionHeading />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expand chart"
          className="block w-full rounded-2xl border border-white/10 bg-white/[0.02] p-3 pt-5 cursor-pointer transition-colors hover:bg-white/[0.04] hover:border-white/20 relative"
        >
          <span className="absolute top-2.5 right-3 flex items-center gap-1 text-white/30 text-[10px] uppercase tracking-[0.1em]">
            <ExpandIcon /> Tap to expand
          </span>
          <RaceChartBody data={data} players={players} labelByIndex={labelByIndex} height={360} />
        </button>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-[#060d1a]/95 backdrop-blur-sm flex flex-col"
          onClick={() => setExpanded(false)}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <div>
              <h3 className="font-black uppercase text-white/90 text-sm tracking-[0.15em]">The Race</h3>
              <p className="text-white/30 text-xs">Total points by game</p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Close"
              className="text-white/50 hover:text-white transition-colors p-2 -mr-2"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {/* Stop propagation so interacting with the chart doesn't close the overlay. */}
          <div className="flex-1 min-h-0 p-3" onClick={(e) => e.stopPropagation()}>
            <RaceChartBody data={data} players={players} labelByIndex={labelByIndex} height="100%" />
          </div>
        </div>
      )}
    </>
  );
}

function RaceChartBody({
  data, players, labelByIndex, height,
}: {
  data: Record<string, number | string>[];
  players: Player[];
  labelByIndex: Map<number, string>;
  height: number | `${number}%`;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -18 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="index"
          stroke="rgba(255,255,255,0.25)"
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          stroke="rgba(255,255,255,0.25)"
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
          tickLine={false}
          allowDecimals={false}
          width={40}
        />
        <Tooltip
          contentStyle={{ background: "#0b1c30", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: "#fde047", fontWeight: 700, marginBottom: 4 }}
          labelFormatter={(i) => labelByIndex.get(Number(i)) ?? `Game ${i}`}
          itemSorter={(item) => -(item.value as number)}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(value) => <span style={{ color: "rgba(255,255,255,0.7)" }}>{value}</span>}
        />
        {players.map((p, i) => (
          <Line
            key={p.id}
            type="monotone"
            dataKey={`p${p.id}`}
            name={p.is_kid ? `⚡ ${p.name}` : p.name}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function ExpandIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function SectionHeading() {
  return (
    <div className="text-center mb-4">
      <h3 className="font-black uppercase text-white/80 text-sm tracking-[0.15em]">The Race</h3>
      <p className="text-white/30 text-xs mt-1">Total points by game</p>
    </div>
  );
}
