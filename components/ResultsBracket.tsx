"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveR32 } from "@/lib/bracket";
import { resolveThirdAssignment, type ThirdEntry } from "@/lib/thirds";
import { BracketTree, type TreeRound, type TreeMatch } from "@/components/BracketTree";
import { TeamHistoryModal, type MatchDTO } from "@/components/TeamHistoryModal";

interface ResultEntry {
  stage: string;
  slot: string;
  team_id: string;
}

interface StandingRow {
  team_id: string;
  points: number;
  played_games: number;
  goal_diff: number;
  goals_for: number;
}

interface Props {
  results: ResultEntry[];
  standings: StandingRow[];
}

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");

// Which third-placed group each relevant winner faces in the R32 (official once the
// group stage is done, which it is by the time knockouts are underway).
function computeThirdAssign(results: ResultEntry[], standings: StandingRow[]): Record<string, string> | null {
  const statByTeam = new Map(standings.map((s) => [s.team_id, s]));
  const thirdByGroup = new Map(results.filter((r) => r.stage === "third").map((r) => [r.slot, r.team_id]));
  const entries: ThirdEntry[] = [];
  for (const g of GROUP_LETTERS) {
    const teamId = thirdByGroup.get(g);
    if (!teamId) continue;
    const st = statByTeam.get(teamId);
    if (!st) continue;
    entries.push({ group: g, teamId, points: st.points, goalDiff: st.goal_diff, goalsFor: st.goals_for, playedGames: st.played_games });
  }
  return resolveThirdAssignment(entries);
}

// Build the real knockout tree straight from the results table. Unlike the picker
// (which derives R16→Final from a player's own picks), every round here reads the
// actual winner the cron recorded — R32 matchups come from resolveR32, and each
// later round pairs the two real winners feeding it.
function buildResultsBracket(results: ResultEntry[], thirdAssign: Record<string, string> | null) {
  const rm = new Map(results.map((r) => [`${r.stage}:${r.slot}`, r.team_id]));
  const r32 = resolveR32(rm, thirdAssign).map((m): TreeMatch => ({ slot: m.slot, team1: m.team1, team2: m.team2 }));

  const feeder = (stage: string, i: number) => rm.get(`${stage}:m${i}`);
  const r16: TreeMatch[] = Array.from({ length: 8 }, (_, i) => ({ slot: `m${i + 1}`, team1: feeder("r32", 2 * i + 1), team2: feeder("r32", 2 * i + 2) }));
  const qf: TreeMatch[] = Array.from({ length: 4 }, (_, i) => ({ slot: `m${i + 1}`, team1: feeder("r16", 2 * i + 1), team2: feeder("r16", 2 * i + 2) }));
  const sf: TreeMatch[] = Array.from({ length: 2 }, (_, i) => ({ slot: `m${i + 1}`, team1: feeder("qf", 2 * i + 1), team2: feeder("qf", 2 * i + 2) }));
  const finalMatch: TreeMatch = { slot: "m1", team1: feeder("sf", 1), team2: feeder("sf", 2) };

  return { r32, r16, qf, sf, finalMatch };
}

// Read-only, real-time World Cup results bracket. The winner of each match is
// pulled from the results table (highlighted green in the tree); tapping any team
// opens its full tournament match history with scorelines.
export function ResultsBracket({ results, standings }: Props) {
  const [modalTeamId, setModalTeamId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchDTO[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  // Fetch real match scores once (cached server-side) so a team's history modal
  // opens instantly. Non-fatal: the bracket itself doesn't need scores.
  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    if (!token) { setLoadingMatches(false); return; }
    fetch("/api/matches", { headers: { "x-session-token": token } })
      .then((r) => (r.ok ? r.json() : { matches: [] }))
      .then((d) => setMatches(d.matches ?? []))
      .catch(() => {})
      .finally(() => setLoadingMatches(false));
  }, []);

  const thirdAssign = useMemo(() => computeThirdAssign(results, standings), [results, standings]);
  const { r32, r16, qf, sf, finalMatch } = useMemo(() => buildResultsBracket(results, thirdAssign), [results, thirdAssign]);

  // The results table doubles as the "winner per slot" map BracketTree renders from.
  const winners = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of results) {
      if (["r32", "r16", "qf", "sf", "final"].includes(r.stage)) out[`${r.stage}:${r.slot}`] = r.team_id;
    }
    return out;
  }, [results]);

  const treeRounds: TreeRound[] = [
    { stage: "r32", label: "R32", matches: r32 },
    { stage: "r16", label: "R16", matches: r16 },
    { stage: "qf", label: "QF", matches: qf },
    { stage: "sf", label: "SF", matches: sf },
  ];

  const hasAnyResult = r32.some((m) => m.team1 || m.team2);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}>
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="mb-1 font-black uppercase leading-none text-white" style={{ fontSize: "clamp(2rem, 7vw, 2.8rem)", letterSpacing: "-0.02em" }}>The Real</p>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-green-400/60" />
            <h2 className="font-black uppercase leading-none text-green-400" style={{ fontSize: "clamp(2rem, 7vw, 2.8rem)", letterSpacing: "-0.02em" }}>Bracket</h2>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-green-400/60" />
          </div>
          <p className="mt-3 text-sm text-white/55">Live World Cup results — tap any team to see their games &amp; scores.</p>
        </div>

        {hasAnyResult ? (
          <BracketTree
            rounds={treeRounds}
            finalMatch={finalMatch}
            picks={winners}
            canPick={false}
            onPick={() => {}}
            onTeamClick={setModalTeamId}
            championKicker="World Cup"
            championPendingText="Still to be decided"
          />
        ) : (
          <div className="mx-auto mt-16 max-w-sm rounded-2xl px-8 py-12 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="mb-3 text-5xl opacity-30">🏟️</div>
            <p className="text-sm text-white/50">The knockout bracket fills in here as the Round of 32 kicks off.</p>
          </div>
        )}
      </div>

      {modalTeamId && (
        <TeamHistoryModal teamId={modalTeamId} matches={matches} loading={loadingMatches} onClose={() => setModalTeamId(null)} />
      )}
    </div>
  );
}
