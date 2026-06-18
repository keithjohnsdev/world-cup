"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GROUPS, getTeam } from "@/lib/data";
import { resolveR32 } from "@/lib/bracket";
import { resolveThirdAssignment, type ThirdEntry } from "@/lib/thirds";
import { FlagIcon } from "@/components/FlagIcon";

type Results = Record<string, string>;   // "stage:slot" → teamId
type Shootouts = Record<string, boolean>; // "stage:slot" → was_shootout
type StandingRow = { team_id: string; points: number; played_games: number; goal_diff: number; goals_for: number };

interface MatchData {
  slot: string;
  team1?: string;
  team2?: string;
}

const POSITIONS = ["group", "runner", "third", "fourth"] as const;
const POS_LABELS = ["1st", "2nd", "3rd", "4th"];
const POS_COLORS = ["text-green-400", "text-blue-400", "text-white/60", "text-white/40"];

// ─── Group card ───────────────────────────────────────────────────────────────

function GroupCard({
  group,
  results,
  setResult,
}: {
  group: (typeof GROUPS)[0];
  results: Results;
  setResult: (stage: string, slot: string, teamId: string) => void;
}) {
  const selected = POSITIONS.map(pos => results[`${pos}:${group.id}`] ?? "");
  const usedIds = new Set(selected.filter(Boolean));
  const complete = selected.every(Boolean);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
      <div className="px-4 py-2.5 bg-white/5 flex items-center justify-between">
        <span className="font-black text-yellow-300 text-lg leading-none">Group {group.id}</span>
        {complete
          ? <span className="text-green-400 text-xs font-black uppercase">✓ Done</span>
          : <span className="text-white/25 text-xs">{selected.filter(Boolean).length}/4</span>
        }
      </div>
      <div className="p-3 space-y-2">
        {POSITIONS.map((pos, i) => {
          const val = selected[i];
          const team = val ? getTeam(val) : null;
          return (
            <div key={pos} className="flex items-center gap-2">
              <span className={`text-xs font-black w-7 shrink-0 tabular-nums ${POS_COLORS[i]}`}>{POS_LABELS[i]}</span>
              <select
                value={val}
                onChange={e => setResult(pos, group.id, e.target.value)}
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-yellow-300/50 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="">— pick team —</option>
                {group.teams.map(t => (
                  <option
                    key={t.id}
                    value={t.id}
                    disabled={usedIds.has(t.id) && val !== t.id}
                  >
                    {t.flag} {t.name}
                  </option>
                ))}
              </select>
              {team && (
                <FlagIcon cc={team.cc} name={team.name} className="w-8 h-[22px] rounded-sm shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Knockout match card ───────────────────────────────────────────────────────

function KnockoutCard({
  stage,
  match,
  results,
  setResult,
  shootouts,
  toggleShootout,
}: {
  stage: string;
  match: MatchData;
  results: Results;
  setResult: (stage: string, slot: string, teamId: string) => void;
  shootouts: Shootouts;
  toggleShootout: (stage: string, slot: string) => void;
}) {
  const key = `${stage}:${match.slot}`;
  const winner = results[key];
  const t1 = match.team1 ? getTeam(match.team1) : undefined;
  const t2 = match.team2 ? getTeam(match.team2) : undefined;
  const canPick = !!(t1 && t2);

  function pick(teamId: string) {
    if (!canPick) return;
    if (winner === teamId) {
      // clear winner
      setResult(stage, match.slot, "");
    } else {
      setResult(stage, match.slot, teamId);
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: winner ? "1px solid rgba(74,222,128,0.22)" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {[match.team1, match.team2].map((teamId, idx) => {
        const team = teamId ? getTeam(teamId) : undefined;
        const isWinner = winner === teamId;
        const isDimmed = !!(winner && !isWinner);
        return (
          <div key={idx}>
            <button
              onClick={() => teamId && pick(teamId)}
              disabled={!canPick || !teamId}
              className={`w-full flex items-center gap-2 px-2.5 py-2 text-left transition-all
                ${canPick && teamId ? "cursor-pointer hover:bg-white/[0.06]" : "cursor-default"}`}
              style={{ background: isWinner ? "rgba(74,222,128,0.13)" : undefined }}
            >
              {team ? (
                <>
                  <FlagIcon
                    cc={team.cc}
                    name={team.name}
                    className={`w-6 h-[17px] rounded-sm shrink-0 transition-opacity ${isDimmed ? "opacity-25" : ""}`}
                  />
                  <span className={`text-xs font-semibold truncate flex-1 leading-tight transition-colors ${isWinner ? "text-green-300" : isDimmed ? "text-white/20" : "text-white/80"}`}>
                    {team.name}
                  </span>
                  {isWinner && <span className="text-green-400 text-[10px] font-black shrink-0">WIN</span>}
                </>
              ) : (
                <span className="text-white/18 text-[11px] italic">TBD</span>
              )}
            </button>
            {idx === 0 && <div className="mx-2.5 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />}
          </div>
        );
      })}
      {winner && (
        <label className="flex items-center gap-2 px-2.5 pb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!shootouts[key]}
            onChange={() => toggleShootout(stage, match.slot)}
            className="rounded accent-yellow-300 cursor-pointer"
          />
          <span className="text-[11px] text-white/40 font-medium">Penalties/Shootout</span>
        </label>
      )}
    </div>
  );
}

// ─── Knockout round section ────────────────────────────────────────────────────

function RoundResults({
  label,
  stage,
  matches,
  results,
  setResult,
  shootouts,
  toggleShootout,
  cols = 2,
}: {
  label: string;
  stage: string;
  matches: MatchData[];
  results: Results;
  setResult: (stage: string, slot: string, teamId: string) => void;
  shootouts: Shootouts;
  toggleShootout: (stage: string, slot: string) => void;
  cols?: 1 | 2;
}) {
  const filled = matches.filter(m => results[`${stage}:${m.slot}`]).length;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-black uppercase tracking-[0.2em] text-green-400">{label}</span>
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
        <span className="text-white/25 text-[11px] tabular-nums">{filled}/{matches.length}</span>
      </div>
      <div className={cols === 2 ? "grid grid-cols-2 gap-2" : "flex justify-center"}>
        {matches.map(m =>
          cols === 2 ? (
            <KnockoutCard key={m.slot} stage={stage} match={m} results={results} setResult={setResult} shootouts={shootouts} toggleShootout={toggleShootout} />
          ) : (
            <div key={m.slot} className="w-full max-w-xs">
              <KnockoutCard stage={stage} match={m} results={results} setResult={setResult} shootouts={shootouts} toggleShootout={toggleShootout} />
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminResultsPage() {
  const [results, setResults] = useState<Results>({});
  const [shootouts, setShootouts] = useState<Shootouts>({});
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    if (!token) { router.replace("/"); return; }
    fetch("/api/admin/results", { headers: { "x-session-token": token } })
      .then(r => { if (r.status === 403) { router.replace("/"); return null; } return r.json(); })
      .then(data => {
        if (!data) return;
        const r: Results = {};
        const s: Shootouts = {};
        for (const row of data.results as { stage: string; slot: string; team_id: string; was_shootout: boolean }[]) {
          r[`${row.stage}:${row.slot}`] = row.team_id;
          if (row.was_shootout) s[`${row.stage}:${row.slot}`] = true;
        }
        setResults(r);
        setShootouts(s);
      })
      .finally(() => setLoading(false));

    // Group standings stats (goal diff / goals for) for ranking the best thirds.
    fetch("/api/results", { headers: { "x-session-token": token } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.standings)) setStandings(d.standings); })
      .catch(() => {});
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  function setResult(stage: string, slot: string, teamId: string) {
    const key = `${stage}:${slot}`;
    setResults(prev => {
      if (!teamId) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: teamId };
    });
  }

  function toggleShootout(stage: string, slot: string) {
    const key = `${stage}:${slot}`;
    setShootouts(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    setSaving(true);
    setMessage(null);

    const entries = Object.entries(results)
      .filter(([, teamId]) => teamId)
      .map(([key, teamId]) => {
        const colIdx = key.indexOf(":");
        const stage = key.slice(0, colIdx);
        const slot  = key.slice(colIdx + 1);
        return { stage, slot, team_id: teamId, was_shootout: shootouts[key] ?? false };
      });

    try {
      const res = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      setMessage(res.ok
        ? { text: `Saved ${data.saved.length} results. Leaderboard updates automatically.`, ok: true }
        : { text: `Error: ${data.error}`, ok: false }
      );
    } catch {
      setMessage({ text: "Save failed — check your connection.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function recalcAwards() {
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    setRecomputing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/awards", {
        method: "POST",
        headers: { "x-session-token": token },
      });
      const data = await res.json();
      setMessage(res.ok
        ? { text: `Awards recomputed — ${data.count} awards updated.`, ok: true }
        : { text: `Awards error: ${data.error}`, ok: false }
      );
    } catch {
      setMessage({ text: "Awards recalculation failed.", ok: false });
    } finally {
      setRecomputing(false);
    }
  }

  // Official R32 third-place assignment, from the live standings (goal stats).
  const thirdAssign = useMemo(() => {
    const stat = new Map(standings.map(s => [s.team_id, s]));
    const entries: ThirdEntry[] = [];
    for (const g of "ABCDEFGHIJKL") {
      const teamId = results[`third:${g}`];
      const s = teamId ? stat.get(teamId) : undefined;
      if (teamId && s) entries.push({ group: g, teamId, points: s.points, goalDiff: s.goal_diff, goalsFor: s.goals_for, playedGames: s.played_games });
    }
    return resolveThirdAssignment(entries);
  }, [standings, results]);

  // Build bracket from entered group results + the third assignment.
  const r32: MatchData[] = resolveR32(new Map(Object.entries(results)), thirdAssign)
    .map(m => ({ slot: m.slot, team1: m.team1, team2: m.team2 }));
  const r16: MatchData[] = Array.from({ length: 8 }, (_, i) => ({
    slot: `m${i + 1}`,
    team1: results[`r32:m${2 * i + 1}`],
    team2: results[`r32:m${2 * i + 2}`],
  }));
  const qf: MatchData[] = Array.from({ length: 4 }, (_, i) => ({
    slot: `m${i + 1}`,
    team1: results[`r16:m${2 * i + 1}`],
    team2: results[`r16:m${2 * i + 2}`],
  }));
  const sf: MatchData[] = [
    { slot: "m1", team1: results["qf:m1"], team2: results["qf:m2"] },
    { slot: "m2", team1: results["qf:m3"], team2: results["qf:m4"] },
  ];
  const finalMatch: MatchData = {
    slot: "m1",
    team1: results["sf:m1"],
    team2: results["sf:m2"],
  };

  const groupsComplete = GROUPS.filter(g => POSITIONS.every(pos => results[`${pos}:${g.id}`])).length;

  return (
    <div className="min-h-screen bg-green-950 text-white pb-24">
      <div className="max-w-3xl mx-auto px-4">

        {/* Header */}
        <div className="flex items-center justify-between py-5 mb-2">
          <div>
            <h1 className="font-black text-2xl uppercase tracking-tight leading-tight">Results Entry</h1>
            <p className="text-green-400 text-sm font-medium">Manual fallback — write actual results to DB</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/admin" className="bg-green-800 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
              ← Admin
            </a>
          </div>
        </div>

        {loading ? (
          <div className="text-white/40 text-center py-20">Loading…</div>
        ) : (
          <>
            {/* ── Group Stage ── */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-black text-white uppercase tracking-wide">Group Stage</h2>
                <div className="flex-1 h-px bg-white/10" />
                <span className={`text-xs font-bold tabular-nums ${groupsComplete === 12 ? "text-green-400" : "text-white/30"}`}>
                  {groupsComplete}/12
                </span>
              </div>
              <p className="text-white/40 text-sm mb-5">Select each group&apos;s finishing order. Used to build the R32 bracket and score group-stage picks.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {GROUPS.map(group => (
                  <GroupCard key={group.id} group={group} results={results} setResult={setResult} />
                ))}
              </div>
            </div>

            {/* ── Knockout Bracket ── */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-black text-white uppercase tracking-wide">Knockout Bracket</h2>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <p className="text-white/40 text-sm mb-5">
                Click the winning team. Teams populate from group results above. Check &ldquo;Penalties/Shootout&rdquo; for shootout decisions (triggers half-point mercy rule).
              </p>
              <RoundResults label="Round of 32" stage="r32" matches={r32} results={results} setResult={setResult} shootouts={shootouts} toggleShootout={toggleShootout} cols={2} />
              <RoundResults label="Round of 16" stage="r16" matches={r16} results={results} setResult={setResult} shootouts={shootouts} toggleShootout={toggleShootout} cols={2} />
              <RoundResults label="Quarterfinals" stage="qf"  matches={qf}  results={results} setResult={setResult} shootouts={shootouts} toggleShootout={toggleShootout} cols={2} />
              <RoundResults label="Semifinals"    stage="sf"  matches={sf}  results={results} setResult={setResult} shootouts={shootouts} toggleShootout={toggleShootout} cols={2} />
              <RoundResults label="The Final"     stage="final" matches={[finalMatch]} results={results} setResult={setResult} shootouts={shootouts} toggleShootout={toggleShootout} cols={1} />

              {results["final:m1"] && (() => {
                const champ = getTeam(results["final:m1"]);
                return champ ? (
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center gap-3 rounded-2xl px-6 py-4 border border-yellow-300/30 bg-yellow-300/7">
                      <span className="text-3xl">🏆</span>
                      <div className="text-left">
                        <div className="text-yellow-300/60 text-[10px] font-black uppercase tracking-widest">Champion</div>
                        <div className="font-black text-white text-lg leading-tight">{champ.name}</div>
                      </div>
                      <FlagIcon cc={champ.cc} name={champ.name} className="w-12 h-8 rounded-md" />
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            {/* ── Status message ── */}
            {message && (
              <div className={`rounded-xl px-4 py-3 mb-4 text-sm font-bold ${message.ok ? "bg-green-500/15 text-green-300 border border-green-500/20" : "bg-red-500/15 text-red-300 border border-red-500/20"}`}>
                {message.ok ? "✓ " : "✗ "}{message.text}
              </div>
            )}

            {/* ── Actions ── */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-4 rounded-2xl font-black text-lg uppercase tracking-wide bg-yellow-300 text-green-950 hover:bg-yellow-200 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {saving ? "Saving…" : "Save Results"}
              </button>
              <button
                onClick={recalcAwards}
                disabled={recomputing}
                className="sm:flex-none px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-wide bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {recomputing ? "Computing…" : "Recalculate Awards"}
              </button>
            </div>
            <p className="text-white/25 text-xs text-center mt-3">
              Leaderboard scores update automatically after save. Recalculate Awards after all results are in.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
