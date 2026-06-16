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
    <div className="max-w-2xl mx-auto px-4 pb-16 -mt-8">
      <SectionHeading />
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 pt-5">
        <ResponsiveContainer width="100%" height={340}>
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
      </div>
    </div>
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
