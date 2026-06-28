"use client";

import { useEffect, useState, useCallback } from "react";
import { GROUPS, getTeam } from "@/lib/data";
import { FlagIcon } from "@/components/FlagIcon";
import { resolveR32 } from "@/lib/bracket";
import { resolveThirdAssignment, type ThirdEntry } from "@/lib/thirds";

const STAGES = ["group", "runner", "third", "fourth"] as const;
type Stage = typeof STAGES[number];

const POS_LABEL: Record<Stage, string> = {
  group: "1st",
  runner: "2nd",
  third: "3rd",
  fourth: "4th",
};

interface Entry { stage: string; slot: string; team_id: string; }

function scorePosition(
  pickedId: string | null,
  posIdx: number,
  actual: (string | null)[],
  played: boolean,
): number {
  // A pick only scores once its team has actually played a match.
  if (!pickedId || !played || !actual.some(Boolean)) return 0;
  const exact = actual[posIdx] === pickedId ? 1 : 0;
  const advance = posIdx < 2 && (actual[0] === pickedId || actual[1] === pickedId) ? 2 : 0;
  return exact + advance;
}

function buildMap(entries: Entry[]): Record<string, (string | null)[]> {
  const map: Record<string, (string | null)[]> = {};
  for (const g of GROUPS) map[g.id] = [null, null, null, null];
  for (const { stage, slot, team_id } of entries) {
    const idx = STAGES.indexOf(stage as Stage);
    if (idx >= 0 && map[slot]) map[slot][idx] = team_id;
  }
  return map;
}

// ── Bracket (knockout) scoring view ────────────────────────────────────────────
// Mirrors lib/scoring.ts: each knockout slot scores its round's base points when the
// player's advanced team matches the actual winner, half on a shootout loss (mercy
// rule), and double when it's the kid's Star Power pick. Picks/results are compared
// per bracket slot, exactly as the scoring engine does.
//
// Each match shows BOTH contestants: for the R32 they come from the real group
// results + best-third assignment; for later rounds they're the player's own feeder
// picks (the two teams they advanced into that slot) — the same way the bracket the
// player filled out is built.

interface BracketPick { stage: string; slot: string; team_id: string; is_star_power?: boolean; }
interface BracketResult { stage: string; slot: string; team_id: string; was_shootout?: boolean; }
interface StandingRow { team_id: string; points: number; played_games: number; goal_diff: number; goals_for: number; }

const KNOCKOUT_ROUNDS: { stage: string; label: string; pts: number; slots: number }[] = [
  { stage: "r32", label: "Round of 32", pts: 2, slots: 16 },
  { stage: "r16", label: "Round of 16", pts: 4, slots: 8 },
  { stage: "qf", label: "Quarterfinals", pts: 8, slots: 4 },
  { stage: "sf", label: "Semifinals", pts: 16, slots: 2 },
  { stage: "final", label: "The Final", pts: 32, slots: 1 },
];

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");
// Feeder round that supplies each round's contestants (R32 is sourced separately).
const FEEDER_OF: Record<string, string> = { r16: "r32", qf: "r16", sf: "qf", final: "sf" };

// One team row inside a match card: shows the flag/name, a left accent when it's the
// player's pick, and a ✓ once it has actually won the match.
function MatchTeam({
  teamId, isPicked, isWinner, decided, outcome, isStar,
}: {
  teamId?: string;
  isPicked: boolean;
  isWinner: boolean;
  decided: boolean;
  outcome: "correct" | "half" | "wrong" | null;
  isStar?: boolean;
}) {
  const team = teamId ? getTeam(teamId) : null;

  let bg: string | undefined;
  let nameCls = "text-white/45";
  if (isPicked && outcome === "correct") { bg = "rgba(22,163,74,0.18)"; nameCls = "text-green-300"; }
  else if (isPicked && outcome === "half") { bg = "rgba(234,179,8,0.15)"; nameCls = "text-yellow-200"; }
  else if (isPicked && outcome === "wrong") { bg = "rgba(239,68,68,0.14)"; nameCls = "text-red-300"; }
  else if (isPicked) { bg = "rgba(255,255,255,0.05)"; nameCls = "text-white"; }
  else if (isWinner) { nameCls = "text-white/75"; }

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5"
      style={{ background: bg, borderLeft: isPicked ? "2px solid rgba(255,255,255,0.5)" : "2px solid transparent" }}
    >
      {team ? (
        <>
          <FlagIcon cc={team.cc} name={team.name} className={`w-6 h-[17px] rounded-sm shrink-0 ${decided && !isWinner ? "opacity-40" : ""}`} />
          <span className={`text-[13px] font-semibold leading-tight truncate flex-1 min-w-0 ${nameCls}`}>{team.name}</span>
          {isStar && isPicked && <span className="text-yellow-300 text-[11px] font-black shrink-0" title="Star Power — points doubled">⭐</span>}
          {isPicked && <span className="text-[8px] font-black uppercase tracking-wider text-white/40 shrink-0">Pick</span>}
          {isWinner && <span className="text-green-400 text-[11px] font-black shrink-0" title="Won the match">✓</span>}
        </>
      ) : (
        <span className="text-[12px] italic text-white/20 flex-1">TBD</span>
      )}
    </div>
  );
}

function BracketScore({
  picks,
  results,
  groupResults,
  standings,
  liveTeamIds,
  bracketScore,
}: {
  picks: BracketPick[];
  results: BracketResult[];
  groupResults: Entry[];       // group/runner/third/fourth standings, for resolving R32
  standings: StandingRow[];    // group_points, for the best-third assignment
  liveTeamIds: string[];
  bracketScore: number;
}) {
  const pickMap = new Map(picks.map((p) => [`${p.stage}:${p.slot}`, p]));
  const resMap = new Map(results.map((r) => [`${r.stage}:${r.slot}`, r]));
  const liveSet = new Set(liveTeamIds);
  const hasPicks = picks.length > 0;

  // Resolve the real R32 matchups (group winners/runners + the best-third assignment).
  const groupResMap = new Map(groupResults.map((r) => [`${r.stage}:${r.slot}`, r.team_id]));
  const statByTeam = new Map(standings.map((s) => [s.team_id, s]));
  const thirdByGroup = new Map(groupResults.filter((r) => r.stage === "third").map((r) => [r.slot, r.team_id]));
  const thirdEntries: ThirdEntry[] = [];
  for (const g of GROUP_LETTERS) {
    const teamId = thirdByGroup.get(g);
    const st = teamId ? statByTeam.get(teamId) : undefined;
    if (teamId && st) thirdEntries.push({ group: g, teamId, points: st.points, goalDiff: st.goal_diff, goalsFor: st.goals_for, playedGames: st.played_games });
  }
  const thirdAssign = resolveThirdAssignment(thirdEntries, true);
  const r32Teams = new Map(resolveR32(groupResMap, thirdAssign).map((m) => [m.slot, [m.team1, m.team2] as const]));

  // The two contestants of any bracket slot.
  const contestants = (stage: string, slotNum: number): [string | undefined, string | undefined] => {
    if (stage === "r32") {
      const t = r32Teams.get(`m${slotNum}`);
      return t ? [t[0], t[1]] : [undefined, undefined];
    }
    const feeder = FEEDER_OF[stage];
    return [pickMap.get(`${feeder}:m${2 * slotNum - 1}`)?.team_id, pickMap.get(`${feeder}:m${2 * slotNum}`)?.team_id];
  };

  if (!hasPicks && results.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3 opacity-30">🏆</div>
        <div className="text-white/40 text-sm">No bracket picks yet.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {KNOCKOUT_ROUNDS.map(({ stage, label, pts, slots }) => {
        // Only show a round once it has at least one pick or one decided match.
        const slotNums = Array.from({ length: slots }, (_, i) => i + 1);
        const anyContent = slotNums.some((n) => pickMap.has(`${stage}:m${n}`) || resMap.has(`${stage}:m${n}`));
        if (!anyContent) return null;

        let earned = 0;
        let correct = 0;
        let decided = 0;

        const cards = slotNums.map((n) => {
          const key = `${stage}:m${n}`;
          const pick = pickMap.get(key);
          const res = resMap.get(key);
          const pickedId = pick?.team_id ?? null;
          const actualId = res?.team_id ?? null;
          const [t1, t2] = contestants(stage, n);

          const isDecided = !!res;
          const isCorrect = isDecided && pickedId != null && pickedId === actualId;
          // Shootout mercy: a non-correct pick on a match decided by penalties earns half.
          const isHalf = isDecided && !isCorrect && pickedId != null && !!res?.was_shootout;
          const isLive = !isDecided && [t1, t2].some((t) => t != null && liveSet.has(t));

          let rowPts = 0;
          if (isCorrect) rowPts = pick?.is_star_power ? pts * 2 : pts;
          else if (isHalf) rowPts = pts / 2;

          if (isDecided) { decided += 1; if (isCorrect) correct += 1; }
          earned += rowPts;

          const outcome: "correct" | "half" | "wrong" | null = !isDecided ? null : isCorrect ? "correct" : isHalf ? "half" : "wrong";
          let ptsCls = "text-white/25";
          if (isCorrect) ptsCls = "text-green-400";
          else if (isHalf) ptsCls = "text-yellow-300";
          else if (isDecided) ptsCls = "text-red-400";

          return { n, key, pick, pickedId, actualId, t1, t2, isDecided, isCorrect, isHalf, isLive, rowPts, ptsCls, outcome };
        });

        return (
          <div key={stage}>
            {/* Round header */}
            <div className="flex items-center justify-between mb-2 px-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-yellow-300 font-black text-xs uppercase tracking-[0.18em]">{label}</span>
                <span className="text-white/30 text-[10px] font-bold uppercase tracking-wide">{pts} pts each</span>
              </div>
              {decided > 0 && (
                <div className="flex items-center gap-2.5">
                  <span className="text-green-300/80 text-[11px] font-bold tabular-nums leading-none">{correct}/{decided} ✓</span>
                  <span className="text-white/50 text-xs font-bold tabular-nums leading-none">+{earned}</span>
                </div>
              )}
            </div>

            {/* Match cards */}
            <div className={`grid gap-2 ${slots > 1 ? "sm:grid-cols-2" : ""}`}>
              {cards.map(({ n, key, pick, pickedId, actualId, t1, t2, isDecided, isHalf, isLive, rowPts, ptsCls, outcome }) => (
                <div key={key} className="rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {/* Card header: match number, status, points */}
                  <div className="flex items-center justify-between px-2.5 py-1" style={{ background: "rgba(0,0,0,0.18)" }}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Match {n}</span>
                    <div className="flex items-center gap-2">
                      {isLive && (
                        <span className="flex items-center gap-1 text-green-400/90 text-[9px] font-black uppercase">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />Live
                        </span>
                      )}
                      {!isDecided && !isLive && pickedId && <span className="text-white/25 text-[9px] font-bold uppercase tracking-wider">Pending</span>}
                      {isHalf && <span className="text-yellow-400/70 text-[9px] font-bold uppercase tracking-wider">Penalties</span>}
                      <span className={`text-xs font-black tabular-nums ${ptsCls}`}>
                        {isDecided ? (rowPts > 0 ? `+${rowPts}` : "0") : pickedId ? "–" : ""}
                      </span>
                    </div>
                  </div>
                  {/* Two contestants */}
                  <MatchTeam teamId={t1} isPicked={!!pickedId && pickedId === t1} isWinner={isDecided && actualId === t1} decided={isDecided} outcome={pickedId === t1 ? outcome : null} isStar={pick?.is_star_power} />
                  <div className="mx-2.5 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <MatchTeam teamId={t2} isPicked={!!pickedId && pickedId === t2} isWinner={isDecided && actualId === t2} decided={isDecided} outcome={pickedId === t2 ? outcome : null} isStar={pick?.is_star_power} />
                  {/* The player's pick busted earlier and isn't one of the two real
                      contestants — show it greyed out with an "Eliminated" badge. */}
                  {pickedId && pickedId !== t1 && pickedId !== t2 && (() => {
                    const pt = getTeam(pickedId);
                    return (
                      <div
                        className="flex items-center gap-2 px-2.5 py-1.5 opacity-50"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderLeft: "2px solid rgba(255,255,255,0.5)" }}
                      >
                        {pt && <FlagIcon cc={pt.cc} name={pt.name} className="w-6 h-[17px] rounded-sm shrink-0 grayscale" />}
                        <span className="text-[13px] font-semibold leading-tight truncate flex-1 min-w-0 text-white/40 line-through">{pt?.name ?? "—"}</span>
                        <span className="text-[8px] font-black uppercase tracking-wider text-white/40 shrink-0">Pick</span>
                        <span
                          className="text-[8px] font-black uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0"
                          style={{ background: "rgba(239,68,68,0.18)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)" }}
                        >
                          Eliminated
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="text-center pt-1">
        <span className="text-white/30 text-[11px]">
          Bracket total: <span className="text-yellow-300 font-black">{bracketScore}</span> pts
        </span>
      </div>
    </div>
  );
}

export interface ScoreBreakdownProps {
  groupScore: number;
  bracketScore: number;
  totalScore: number;
  championBonus: number;
  chargeupBonus: number;
  heartPickBonus: number;
  starPowerBonus: number;
  kabooseBoosts: number;
  isKid: boolean;
}

interface Props {
  userId: number;
  userName: string;
  breakdown: ScoreBreakdownProps;
  // True once the group stage is over (phase2+) — switches "currently in" to "finished".
  groupStageComplete?: boolean;
  // Team ids currently in a live match — get a pulsing "playing now" dot.
  liveTeamIds?: string[];
  onClose: () => void;
}

export function GroupPicksModal({ userId, userName, breakdown, groupStageComplete, liveTeamIds = [], onClose }: Props) {
  const [picks, setPicks] = useState<Entry[]>([]);
  const [results, setResults] = useState<Entry[]>([]);
  const [bracketPicks, setBracketPicks] = useState<BracketPick[]>([]);
  const [bracketResults, setBracketResults] = useState<BracketResult[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [heartPickTeamId, setHeartPickTeamId] = useState<string | null>(null);
  const [heartPoints, setHeartPoints] = useState(0);
  const [championPickTeamId, setChampionPickTeamId] = useState<string | null>(null);
  const [playedTeamIds, setPlayedTeamIds] = useState<string[]>([]);
  const [groupPoints, setGroupPoints] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  // Bracket is the active phase now, so it leads; Groups holds the existing view.
  const [tab, setTab] = useState<"bracket" | "groups">("bracket");

  useEffect(() => {
    fetch(`/api/picks/${userId}`)
      .then(r => r.json())
      .then(d => {
        setPicks(d.picks ?? []);
        setResults(d.results ?? []);
        setBracketPicks(d.bracketPicks ?? []);
        setBracketResults(d.bracketResults ?? []);
        setStandings(d.standings ?? []);
        setHeartPickTeamId(d.heartPickTeamId ?? null);
        setHeartPoints(d.heartPoints ?? 0);
        setChampionPickTeamId(d.championPickTeamId ?? null);
        setPlayedTeamIds(d.playedTeamIds ?? []);
        setGroupPoints(d.groupPoints ?? {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  // Push a history entry when the modal opens so the browser back button closes it.
  // popstate fires when the user navigates back → triggers onClose.
  // handleClose goes back in history, which fires popstate, which calls onClose —
  // so onClose is always called exactly once regardless of how the modal is dismissed.
  useEffect(() => {
    history.pushState({ groupPicksModal: true }, "");
    const handlePop = () => onClose();
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [onClose]);

  const handleClose = useCallback(() => {
    history.back(); // triggers popstate → onClose
  }, []);

  const pickMap = buildMap(picks);
  const resultMap = buildMap(results);
  const playedSet = new Set(playedTeamIds);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/75 md:block hidden" onClick={handleClose} />

      {/* Full-screen on mobile, centered dialog on md+ */}
      <div
        className="fixed inset-0 z-50 flex flex-col md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[88vh] md:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d2137", border: "1px solid rgba(255,255,255,0.12)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-4 shrink-0"
          style={{ background: "linear-gradient(135deg, #1d4270 0%, #163358 100%)" }}
        >
          {/* Mobile back button */}
          <button
            onClick={handleClose}
            className="md:hidden flex items-center gap-1.5 text-white/60 hover:text-white transition-all shrink-0 -ml-1 pr-1"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4L6 9l5 5" />
            </svg>
            <span className="text-xs font-black uppercase tracking-wider">Back</span>
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-white font-black text-lg leading-tight truncate">{userName}</div>
            <div className="text-green-400 text-xs font-bold uppercase tracking-wider mt-0.5">{tab === "bracket" ? "Bracket Picks" : "Group Stage Picks"}</div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-yellow-300 font-black text-2xl leading-none">{breakdown.totalScore}</div>
            <div className="text-white/40 text-[10px] uppercase tracking-wide">total pts</div>
          </div>

          {/* Desktop close button */}
          <button
            onClick={handleClose}
            className="hidden md:flex w-8 h-8 shrink-0 items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all text-base"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-white/30 text-sm text-center py-20">Loading…</div>
          ) : (
            <>
            {/* Score breakdown */}
            {(() => {
              const { groupScore, bracketScore, championBonus, chargeupBonus, heartPickBonus, starPowerBonus, kabooseBoosts } = breakdown;
              const hasAnyScore = groupScore > 0 || bracketScore > 0 || championBonus > 0 || chargeupBonus > 0 || heartPickBonus > 0 || starPowerBonus > 0 || kabooseBoosts > 0;
              if (!hasAnyScore) return null;
              const rows: { label: string; value: number; color: string }[] = [
                { label: "Groups", value: groupScore, color: "text-white/70" },
                { label: "Bracket", value: bracketScore, color: "text-white/70" },
                ...(championBonus > 0 ? [{ label: "Champion", value: championBonus, color: "text-yellow-300" }] : []),
                ...(chargeupBonus > 0 ? [{ label: "Charge-Up ⚡", value: chargeupBonus, color: "text-yellow-300" }] : []),
                ...(heartPickBonus > 0 ? [{ label: "Heart Pick ❤️", value: heartPickBonus, color: "text-red-400" }] : []),
                ...(starPowerBonus > 0 ? [{ label: "Star Power ⭐", value: starPowerBonus, color: "text-yellow-300" }] : []),
                ...(kabooseBoosts > 0 ? [{ label: "Kaboose 🚃", value: kabooseBoosts, color: "text-purple-400" }] : []),
              ];
              return (
                <div className="rounded-xl px-4 py-3 mb-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Score Breakdown</div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                    {rows.map(({ label, value, color }) => (
                      <div key={label} className="flex items-baseline gap-1.5">
                        <span className="text-white/40 text-[11px]">{label}</span>
                        <span className={`font-black text-sm tabular-nums ${color}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Bracket / Groups tab switcher */}
            <div className="flex justify-center py-1">
              <div className="inline-flex items-center gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {([["bracket", "Bracket"], ["groups", "Groups"]] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setTab(v)}
                    className={`rounded-full px-5 py-1.5 text-[11px] font-black uppercase tracking-widest transition-colors ${tab === v ? "text-green-950" : "text-white/50 hover:text-white"}`}
                    style={{ background: tab === v ? "#fbbf24" : "transparent" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {tab === "bracket" && (<>
            {/* Champion pick */}
            {(() => {
              const championTeam = championPickTeamId ? getTeam(championPickTeamId) : null;
              const finalRes = bracketResults.find((r) => r.stage === "final" && r.slot === "m1");
              const championWon = !!(championTeam && finalRes && finalRes.team_id === championPickTeamId);
              const championBonus = breakdown.championBonus + breakdown.chargeupBonus;
              if (!championTeam) return null;
              return (
                <div className="rounded-xl overflow-hidden mb-1" style={{ border: "1px solid rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.06)" }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg leading-none">🏆</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-yellow-300/60 text-[10px] font-black uppercase tracking-[0.2em] mb-0.5">Champion Pick</div>
                      <div className="flex items-center gap-2">
                        <FlagIcon cc={championTeam.cc} name={championTeam.name} className="w-8 h-[22px] rounded shrink-0" />
                        <span className="text-white font-bold text-sm truncate">{championTeam.name}</span>
                        {championWon && <span className="text-green-400 text-[11px] font-black shrink-0">✓</span>}
                      </div>
                    </div>
                    {championWon && championBonus > 0 && (
                      <span className="text-yellow-300 font-black text-sm tabular-nums shrink-0">+{championBonus}</span>
                    )}
                  </div>
                </div>
              );
            })()}
            {/* Heart pick (kids only) */}
            {(() => {
              const heartTeam = breakdown.isKid && heartPickTeamId ? getTeam(heartPickTeamId) : null;
              if (!heartTeam) return null;
              return (
                <div className="rounded-xl overflow-hidden mb-1" style={{ border: "1px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.06)" }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg leading-none">❤️</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-red-400/60 text-[10px] font-black uppercase tracking-[0.2em] mb-0.5">Heart Pick</div>
                      <div className="flex items-center gap-2">
                        <FlagIcon cc={heartTeam.cc} name={heartTeam.name} className="w-8 h-[22px] rounded shrink-0" />
                        <span className="text-white font-bold text-sm truncate">{heartTeam.name}</span>
                      </div>
                    </div>
                    {heartPoints > 0 && (
                      <span className="text-red-400 font-black text-sm tabular-nums shrink-0">+{heartPoints}</span>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="pt-2">
              <BracketScore
                picks={bracketPicks}
                results={bracketResults}
                groupResults={results}
                standings={standings}
                liveTeamIds={liveTeamIds}
                bracketScore={breakdown.bracketScore}
              />
            </div>
            </>)}

            {tab === "groups" && (
            <div className="space-y-3 pt-2">
            {GROUPS.map(group => {
              const predicted = pickMap[group.id] ?? [];
              const actual = resultMap[group.id] ?? [];
              const groupHasResult = actual.some(Boolean);
              const groupPts = STAGES.reduce((s, _, i) => {
                const pid = predicted[i] ?? null;
                return s + scorePosition(pid, i, actual, pid != null && playedSet.has(pid));
              }, 0);

              return (
                <div key={group.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.09)" }}>
                  {/* Group header */}
                  <div
                    className="flex items-center justify-between px-4 py-2"
                    style={{ background: "linear-gradient(135deg, #1d4270 0%, #163358 100%)" }}
                  >
                    <span className="text-yellow-300 font-black text-xs uppercase tracking-[0.2em]">Group {group.id}</span>
                    {groupHasResult && (
                      <div className="flex items-center gap-2">
                        {groupPts === 8 && (
                          <span
                            className="inline-flex items-center text-green-300 text-[10px] font-black uppercase tracking-wide rounded-full px-2 py-0.5 leading-none"
                            style={{ background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.45)" }}
                          >
                            <span className="relative top-[0.5px] sm:-top-[0.5px]">Perfect group!</span>
                          </span>
                        )}
                        <span className="text-white/50 text-xs font-bold tabular-nums leading-none">{groupPts} / 8 pts</span>
                      </div>
                    )}
                  </div>

                  {/* Column labels — only once results exist */}
                  {groupHasResult && (
                    <div
                      className="flex items-center gap-3 px-4 py-1"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.18)" }}
                    >
                      <div className="w-7 shrink-0" />
                      <div className="flex-1 text-white/30 text-[9px] font-black uppercase tracking-[0.18em]">Your Pick</div>
                      {/* Keep the column width fixed (matches the points column below) so
                          the "Actual"/"Final" label stays aligned with the flags. */}
                      <div className="shrink-0 flex items-center">
                        <span className="w-[4.5rem] text-center text-white/30 text-[9px] font-black uppercase tracking-[0.18em]">
                          {groupStageComplete ? "Final" : "Actual"}
                        </span>
                        <span className="w-8 ml-3" />
                      </div>
                    </div>
                  )}

                  {/* 4 position rows */}
                  {STAGES.map((stage, posIdx) => {
                    const pickedId = predicted[posIdx] ?? null;
                    const team = pickedId ? getTeam(pickedId) : null;
                    const played = pickedId != null && playedSet.has(pickedId);
                    const pts = scorePosition(pickedId, posIdx, actual, played);

                    // The team actually sitting in this real position right now.
                    const actualId = actual[posIdx] ?? null;
                    const actualTeam = actualId ? getTeam(actualId) : null;
                    const isExact = played && actualId === pickedId;

                    // Picked but the team hasn't kicked off yet — scores nothing so far.
                    const notPlayed = groupHasResult && pickedId != null && !played;

                    let rowBg = "";
                    let ptsCls = "text-white/20";
                    if (notPlayed) {
                      rowBg = "rgba(255,255,255,0.02)";
                      ptsCls = "text-white/25";
                    } else if (groupHasResult && pickedId) {
                      if (pts >= 3)       { rowBg = "rgba(22,163,74,0.16)";  ptsCls = "text-green-400"; }
                      else if (pts === 2) { rowBg = "rgba(234,179,8,0.13)";  ptsCls = "text-yellow-300"; }
                      else if (pts === 1) { rowBg = "rgba(96,165,250,0.12)"; ptsCls = "text-blue-400"; }
                      else               { rowBg = "rgba(239,68,68,0.11)";  ptsCls = "text-red-400"; }
                    }

                    // The line between 2nd and 3rd — i.e. the top of the 3rd row —
                    // marks the qualification cutoff: positions above it advance and
                    // earn the +2 bonus, so accentuate it.
                    const isCutoff = posIdx === 2;

                    return (
                      <div
                        key={stage}
                        className="flex items-center gap-3 px-4 py-2.5"
                        style={{
                          background: rowBg || undefined,
                          borderTop: isCutoff
                            ? "1px solid rgba(234,179,8,0.55)"
                            : "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <div className="w-7 shrink-0 text-center text-[11px] font-black text-white/30 tabular-nums">
                          {POS_LABEL[stage]}
                        </div>

                        {/* Your pick */}
                        {team ? (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FlagIcon cc={team.cc} name={team.name} className="w-8 h-[22px] rounded shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-white text-sm font-semibold leading-tight truncate">{team.name}</span>
                                {team.id === heartPickTeamId && heartPoints > 0 && (
                                  <span className="text-red-400 text-[11px] font-black shrink-0 whitespace-nowrap">+{heartPoints} ❤️</span>
                                )}
                              </div>
                              {notPlayed && (
                                <div className="text-white/30 text-[10px] italic leading-none mt-0.5">hasn’t played yet</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 text-white/20 text-sm italic">No pick</div>
                        )}

                        {/* Actual — the flag of whoever is really in this position,
                            with their live group points alongside */}
                        {groupHasResult && (
                          <div className="relative w-[4.5rem] shrink-0 flex items-center justify-center gap-2.5">
                            {actualTeam ? (
                              <>
                                <FlagIcon
                                  cc={actualTeam.cc}
                                  name={actualTeam.name}
                                  className={`w-8 h-[22px] rounded ${
                                    isExact
                                      ? "ring-2 ring-green-400/90 ring-offset-1 ring-offset-[#0d2137] shadow-[0_0_6px_1px_rgba(74,222,128,0.55)]"
                                      : actualId != null && playedSet.has(actualId)
                                        ? "opacity-90"
                                        : "opacity-40" /* provisional — this team hasn't played */
                                  }`}
                                />
                                {actualId != null && playedSet.has(actualId) ? (
                                  <span className="text-white/55 text-[11px] font-bold tabular-nums leading-none w-4 text-left">
                                    {groupPoints[actualId] ?? 0}
                                  </span>
                                ) : (
                                  <span className="text-white/20 text-[11px] font-bold tabular-nums leading-none w-4 text-left">
                                    –
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-white/20 text-xs">—</span>
                            )}
                          </div>
                        )}

                        {/* Points */}
                        {groupHasResult && (
                          <div className={`w-8 shrink-0 text-right text-sm font-black tabular-nums ${pickedId ? ptsCls : "text-white/20"}`}>
                            {pickedId ? `+${pts}` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            </div>
            )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
