"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Player {
  id: number;
  name: string;
  groupsComplete: number;
  groupsDone: boolean;
  championPicked: boolean;
  bracketPicks: number;
  bracketDone: boolean;
  joinedAt: string;
}

type SortKey = "name" | "groups" | "bracket";

const PHASE_LABELS: Record<string, string> = {
  phase1_open:   "Phase 1 Open",
  phase1_locked: "Phase 1 Locked",
  phase2_open:   "Phase 2 Open",
  phase2_locked: "Phase 2 Locked",
  complete:      "Complete",
};

const PHASE_TRANSITIONS: Record<string, { label: string; next: string; confirm: string; color: string }[]> = {
  phase1_open:   [{ label: "Lock Group Stage & Open Bracket",  next: "phase2_open",   confirm: "This locks all group picks and opens bracket picks for everyone. Continue?", color: "bg-yellow-300 text-green-950 hover:bg-yellow-200" }],
  phase1_locked: [{ label: "Open Bracket Picks",               next: "phase2_open",   confirm: "Open Phase 2 bracket picks for everyone. Continue?",                         color: "bg-green-500 text-white hover:bg-green-400" }],
  phase2_open:   [{ label: "Lock Bracket Picks",               next: "phase2_locked", confirm: "Lock all bracket picks. Continue?",                                           color: "bg-orange-400 text-white hover:bg-orange-300" }],
  phase2_locked: [{ label: "Mark Tournament Complete",         next: "complete",      confirm: "Mark the tournament as complete. Continue?",                                  color: "bg-red-500 text-white hover:bg-red-400" }],
  complete:      [],
};

export default function AdminPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState("phase1_open");
  const [bracketTotal, setBracketTotal] = useState(31);
  const [loading, setLoading] = useState(true);
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("groups");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const router = useRouter();

  function fetchData() {
    const token = localStorage.getItem("wc_token");
    if (!token) { router.replace("/"); return; }
    setLoading(true);
    fetch("/api/admin/players", { headers: { "x-session-token": token } })
      .then((r) => {
        if (r.status === 403) { router.replace("/"); return null; }
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setPlayers(data.players);
        setPhase(data.phase);
        setBracketTotal(data.bracketTotal);
        setLastRefresh(new Date());
      })
      .catch(() => setError("Failed to load. Are you Keith?"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function transitionPhase(nextPhase: string, confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return;
    setPhaseLoading(true);
    const token = localStorage.getItem("wc_token");
    try {
      const res = await fetch("/api/admin/phase", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token! },
        body: JSON.stringify({ phase: nextPhase }),
      });
      if (!res.ok) throw new Error("Failed");
      setPhase(nextPhase);
    } catch {
      setError("Phase update failed.");
    } finally {
      setPhaseLoading(false);
    }
  }

  const showBracket = phase !== "phase1_open" && phase !== "phase1_locked";

  const sorted = [...players].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "groups") {
      // Incomplete first, then by groups filled desc
      if (a.groupsDone !== b.groupsDone) return Number(a.groupsDone) - Number(b.groupsDone);
      return b.groupsComplete - a.groupsComplete;
    }
    if (sort === "bracket") {
      if (a.bracketDone !== b.bracketDone) return Number(a.bracketDone) - Number(b.bracketDone);
      return b.bracketPicks - a.bracketPicks;
    }
    return 0;
  });

  const groupsDoneCount = players.filter((p) => p.groupsDone).length;
  const bracketDoneCount = players.filter((p) => p.bracketDone).length;
  const championDoneCount = players.filter((p) => p.championPicked).length;

  return (
    <div className="min-h-screen bg-green-950 text-white p-4 pb-16">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <div>
            <h1 className="font-black text-2xl uppercase tracking-tight">Admin</h1>
            <p className="text-green-400 text-sm font-medium capitalize">{phase.replace(/_/g, " ")} · {players.length} players</p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-white/30 text-xs">
                {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={fetchData}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer"
            >
              ↻ Refresh
            </button>
            <a
              href="/"
              className="bg-green-800 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
            >
              ← Back
            </a>
          </div>
        </div>

        {error && <p className="text-red-400 mb-4">{error}</p>}

        {/* Phase control */}
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1">Current Phase</div>
              <div className="font-black text-lg text-white">{PHASE_LABELS[phase] ?? phase}</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(PHASE_TRANSITIONS[phase] ?? []).map((t) => (
                <button
                  key={t.next}
                  onClick={() => transitionPhase(t.next, t.confirm)}
                  disabled={phaseLoading}
                  className={`px-4 py-2 rounded-xl font-black text-sm uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50 ${t.color}`}
                >
                  {phaseLoading ? "Saving…" : t.label}
                </button>
              ))}
              {phase === "complete" && (
                <span className="text-white/30 text-sm font-bold self-center">Tournament over 🏆</span>
              )}
            </div>
          </div>
        </div>

        {/* Summary cards */}
        {!loading && players.length > 0 && (
          <div className={`grid gap-3 mb-6 ${showBracket ? "grid-cols-3" : "grid-cols-2"}`}>
            <StatCard
              label="Groups Done"
              value={`${groupsDoneCount}/${players.length}`}
              done={groupsDoneCount === players.length}
              sub={`${championDoneCount}/${players.length} picked champion`}
            />
            {showBracket && (
              <StatCard
                label="Bracket Done"
                value={`${bracketDoneCount}/${players.length}`}
                done={bracketDoneCount === players.length}
                sub={`${bracketTotal} picks total`}
              />
            )}
            <StatCard
              label="Not Started"
              value={String(players.filter((p) => p.groupsComplete === 0).length)}
              done={players.filter((p) => p.groupsComplete === 0).length === 0}
              sub="0 groups filled"
              invert
            />
          </div>
        )}

        {/* Sort tabs */}
        {!loading && (
          <div className="flex gap-1 mb-3">
            {(["groups", showBracket && "bracket", "name"].filter(Boolean) as SortKey[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-colors cursor-pointer ${
                  sort === s ? "bg-yellow-300 text-green-950" : "bg-white/10 text-white/60 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Player table */}
        {loading ? (
          <div className="text-white/40 text-center py-16">Loading...</div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-white/10">
            {/* Table header */}
            <div className={`grid px-4 py-2 bg-white/5 text-white/40 text-xs font-black uppercase tracking-widest ${showBracket ? "grid-cols-[1fr_5rem_5rem_5rem]" : "grid-cols-[1fr_5rem_5rem]"}`}>
              <span>Player</span>
              <span className="text-center">Groups</span>
              {showBracket && <span className="text-center">Bracket</span>}
              <span className="text-center">Champ</span>
            </div>

            {sorted.map((player, i) => (
              <div
                key={player.id}
                className={`grid px-4 py-3.5 border-t border-white/5 items-center ${
                  showBracket ? "grid-cols-[1fr_5rem_5rem_5rem]" : "grid-cols-[1fr_5rem_5rem]"
                } ${player.groupsComplete === 0 ? "bg-red-500/5" : ""}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white/20 text-xs tabular-nums w-5 shrink-0">{i + 1}</span>
                  <span className="font-bold text-sm truncate">{player.name}</span>
                  {player.groupsDone && (!showBracket || player.bracketDone) && (
                    <span className="text-green-400 text-xs shrink-0">✓</span>
                  )}
                </div>

                {/* Groups */}
                <div className="text-center">
                  <GroupBadge complete={player.groupsComplete} total={12} done={player.groupsDone} />
                </div>

                {/* Bracket */}
                {showBracket && (
                  <div className="text-center">
                    <PickBadge picks={player.bracketPicks} total={bracketTotal} done={player.bracketDone} />
                  </div>
                )}

                {/* Champion */}
                <div className="text-center">
                  {player.championPicked
                    ? <span className="text-green-400 font-bold text-sm">✓</span>
                    : <span className="text-red-400/60 font-bold text-sm">✗</span>
                  }
                </div>
              </div>
            ))}

            {players.length === 0 && (
              <div className="px-4 py-10 text-center text-white/30 text-sm">No players yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, done, sub, invert = false }: {
  label: string; value: string; done: boolean; sub: string; invert?: boolean;
}) {
  const good = invert ? value === "0" : done;
  return (
    <div className={`rounded-xl px-4 py-3 border ${good ? "border-green-500/30 bg-green-500/10" : "border-white/10 bg-white/5"}`}>
      <div className="text-white/50 text-xs font-bold uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-black text-2xl leading-none ${good ? "text-green-400" : "text-white"}`}>{value}</div>
      <div className="text-white/30 text-xs mt-1">{sub}</div>
    </div>
  );
}

function GroupBadge({ complete, total, done }: { complete: number; total: number; done: boolean }) {
  if (done) return <span className="inline-block bg-green-500/20 text-green-400 text-xs font-black px-2 py-0.5 rounded-full">✓ Done</span>;
  if (complete === 0) return <span className="inline-block bg-red-500/20 text-red-400 text-xs font-black px-2 py-0.5 rounded-full">0/{total}</span>;
  return <span className="inline-block bg-yellow-300/15 text-yellow-300 text-xs font-black px-2 py-0.5 rounded-full">{complete}/{total}</span>;
}

function PickBadge({ picks, total, done }: { picks: number; total: number; done: boolean }) {
  if (done) return <span className="inline-block bg-green-500/20 text-green-400 text-xs font-black px-2 py-0.5 rounded-full">✓ Done</span>;
  if (picks === 0) return <span className="inline-block bg-red-500/20 text-red-400 text-xs font-black px-2 py-0.5 rounded-full">0/{total}</span>;
  return <span className="inline-block bg-yellow-300/15 text-yellow-300 text-xs font-black px-2 py-0.5 rounded-full">{picks}/{total}</span>;
}
