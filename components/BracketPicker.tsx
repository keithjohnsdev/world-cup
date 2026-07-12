"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveR32, sourceLabel, SF_QF_FEEDERS, type ResolvedMatch, type SlotSource } from "@/lib/bracket";
import { resolveThirdAssignment, type ThirdEntry } from "@/lib/thirds";
import { getTeam } from "@/lib/data";
import { FlagIcon } from "@/components/FlagIcon";
import { BracketTree, type TreeRound, type TreeMatch } from "@/components/BracketTree";

type Picks = Record<string, string>;
// The three ways to view/fill the bracket: the connected tree, the round-by-round
// list, and "Baby Mode" — huge two-flag rows for a toddler to tap a winner.
type BracketView = "tree" | "list" | "baby";

// The five knockout pick stages, used to scope "real bracket" reads/clears.
const KNOCKOUT_KEYS = new Set(["r32", "r16", "qf", "sf", "final"]);

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

interface MatchData {
  slot: string;
  team1?: string;
  team2?: string;
}

interface Props {
  picks: Picks;
  results: ResultEntry[];
  standings: StandingRow[];
  phase: string;
  preview?: boolean;
  // Per-player freeze (from the bracket_lock setting). When true, this player's
  // bracket is read-only even while the phase would otherwise allow picking.
  locked?: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
}

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");

// Determine which third-placed group each relevant winner faces (or null until the
// group stage is complete enough to rank the thirds). Pure standings → assignment.
function computeThirdAssign(results: ResultEntry[], standings: StandingRow[]): Record<string, string> | null {
  const statByTeam = new Map(standings.map((s) => [s.team_id, s]));
  const thirdByGroup = new Map(results.filter((r) => r.stage === "third").map((r) => [r.slot, r.team_id]));

  const entries: ThirdEntry[] = [];
  for (const g of GROUP_LETTERS) {
    const teamId = thirdByGroup.get(g);
    if (!teamId) continue;
    const st = statByTeam.get(teamId);
    if (!st) continue;
    entries.push({
      group: g,
      teamId,
      points: st.points,
      goalDiff: st.goal_diff,
      goalsFor: st.goals_for,
      playedGames: st.played_games,
    });
  }
  // Provisional: resolve from the current standings so the practice bracket is
  // playable before the group stage ends (the qualifiers shift as results land).
  return resolveThirdAssignment(entries, true);
}

// Whether every group has finished (all 12 thirds known and played all 3 games),
// so the third-placed qualifiers are final rather than provisional.
function groupStageComplete(results: ResultEntry[], standings: StandingRow[]): boolean {
  const played = new Map(standings.map((s) => [s.team_id, s.played_games]));
  const thirds = results.filter((r) => r.stage === "third");
  return thirds.length >= 12 && thirds.every((r) => (played.get(r.team_id) ?? 0) >= 3);
}

// Whether the team currently in each of a group's qualifying positions is
// mathematically *locked* into that exact rank, or merely the current leader.
type SlotLocks = { winner: boolean; runner: boolean; third: boolean };

// Sound clinch detection from the current group standings. A position is reported
// locked only when the team holding it is guaranteed to finish in exactly that rank
// no matter how the remaining group games go. The test uses a points-only bound
// (max attainable points for each rival), so it is conservative: it never reports a
// lock that isn't certain, though it may stay "likely" in cases a tiebreaker would
// actually decide. A finished group (all four teams played 3) is locked outright.
// Third place additionally requires the whole group stage to be done, since a 3rd's
// bracket slot depends on the cross-group ranking of the best eight thirds.
function computeGroupLocks(standings: StandingRow[], groupComplete: boolean): Record<string, SlotLocks> {
  const byGroup = new Map<string, StandingRow[]>();
  for (const s of standings) {
    const g = getTeam(s.team_id)?.group;
    if (!g) continue;
    (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(s);
  }

  const out: Record<string, SlotLocks> = {};
  for (const [g, rowsRaw] of byGroup) {
    // Without all four teams in the table we can't bound the missing ones — stay safe.
    if (rowsRaw.length < 4) {
      out[g] = { winner: false, runner: false, third: false };
      continue;
    }
    const rows = [...rowsRaw].sort(
      (a, b) => b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for,
    );

    // Whole group played out → the table is final, every position decided.
    if (rows.every((r) => r.played_games >= 3)) {
      out[g] = { winner: true, runner: true, third: groupComplete };
      continue;
    }

    const maxPts = (r: StandingRow) => r.points + 3 * Math.max(0, 3 - r.played_games);
    // For the team at rank `idx`, count rivals guaranteed strictly above / below it.
    const lockedRank = (idx: number) => {
      const t = rows[idx];
      let above = 0;
      let below = 0;
      rows.forEach((o, j) => {
        if (j === idx) return;
        if (o.points > maxPts(t)) above++; // rival's floor beats T's ceiling
        else if (t.points > maxPts(o)) below++; // T's floor beats rival's ceiling
      });
      return { above, below };
    };

    const w = lockedRank(0);
    const r = lockedRank(1);
    out[g] = {
      winner: w.below === 3, // everyone else guaranteed below → exactly 1st
      runner: r.above === 1 && r.below === 2, // one above, two below → exactly 2nd
      third: false, // 3rd only locks once the full group stage settles qualification
    };
  }
  return out;
}

// Is the team filling this slot source locked into it, given the per-group clinch
// map and (for thirds) whether the group stage is complete?
function sourceLocked(
  s: SlotSource,
  locks: Record<string, SlotLocks>,
  thirdAssign: Record<string, string> | null,
  groupComplete: boolean,
): boolean {
  if (s.kind === "winner") return !!locks[s.group]?.winner;
  if (s.kind === "runner") return !!locks[s.group]?.runner;
  const g = thirdAssign?.[s.group];
  return !!(g && groupComplete && locks[g]?.third);
}

// Build the full bracket. R32 comes from the live standings + third assignment;
// R16 → Final are derived from the player's own picks (sequential pairing reproduces
// the official tree because R32_STRUCTURE is in bracket order).
function buildBracket(results: ResultEntry[], picks: Picks, thirdAssign: Record<string, string> | null) {
  const rm = new Map(results.map((r) => [`${r.stage}:${r.slot}`, r.team_id]));
  const r32resolved = resolveR32(rm, thirdAssign);
  const r32: MatchData[] = r32resolved.map((m) => ({ slot: m.slot, team1: m.team1, team2: m.team2 }));

  const r16: MatchData[] = Array.from({ length: 8 }, (_, i) => ({
    slot: `m${i + 1}`,
    team1: picks[`r32:m${2 * i + 1}`],
    team2: picks[`r32:m${2 * i + 2}`],
  }));

  const qf: MatchData[] = Array.from({ length: 4 }, (_, i) => ({
    slot: `m${i + 1}`,
    team1: picks[`r16:m${2 * i + 1}`],
    team2: picks[`r16:m${2 * i + 2}`],
  }));

  // Semifinals pair the quarterfinals non-adjacently (QF1+QF3, QF2+QF4) — see
  // SF_QF_FEEDERS. Using it keeps the pick bracket's tree identical to the real one.
  const sf: MatchData[] = SF_QF_FEEDERS.map(([a, b], i) => ({
    slot: `m${i + 1}`,
    team1: picks[`qf:m${a}`],
    team2: picks[`qf:m${b}`],
  }));

  const finalMatch: MatchData = { slot: "m1", team1: picks["sf:m1"], team2: picks["sf:m2"] };

  return { r32resolved, r32, r16, qf, sf, finalMatch };
}

function TeamRow({
  teamId,
  isWinner,
  isDimmed,
  canClick,
  onClick,
}: {
  teamId?: string;
  isWinner: boolean;
  isDimmed: boolean;
  canClick: boolean;
  onClick: () => void;
}) {
  const team = teamId ? getTeam(teamId) : undefined;

  return (
    <button
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      className={`w-full flex items-center gap-2 px-2.5 py-2 transition-all text-left
        ${canClick ? "cursor-pointer hover:bg-white/[0.06]" : "cursor-default"}
      `}
      style={{ background: isWinner ? "rgba(74,222,128,0.13)" : undefined }}
    >
      {team ? (
        <>
          <FlagIcon
            cc={team.cc}
            name={team.name}
            className={`w-6 h-[17px] rounded-sm shrink-0 transition-opacity ${isDimmed ? "opacity-25" : ""}`}
          />
          <span
            className={`text-xs font-semibold truncate flex-1 leading-tight transition-colors
              ${isWinner ? "text-green-300" : isDimmed ? "text-white/20" : "text-white/80"}
            `}
          >
            {team.name}
          </span>
          {isWinner && <span className="text-green-400 text-[10px] font-black shrink-0">✓</span>}
        </>
      ) : (
        <span className="text-white/18 text-[11px] italic">TBD</span>
      )}
    </button>
  );
}

function MatchCard({
  match,
  stage,
  winner,
  canPick,
  onPick,
}: {
  match: MatchData;
  stage: string;
  winner?: string;
  canPick: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
}) {
  const bothTeams = !!(match.team1 && match.team2);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: winner
          ? "1px solid rgba(74,222,128,0.22)"
          : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <TeamRow
        teamId={match.team1}
        isWinner={winner === match.team1}
        isDimmed={!!(winner && winner !== match.team1)}
        canClick={canPick && bothTeams && !!match.team1}
        onClick={() => match.team1 && onPick(stage, match.slot, match.team1)}
      />
      <div className="mx-2.5 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
      <TeamRow
        teamId={match.team2}
        isWinner={winner === match.team2}
        isDimmed={!!(winner && winner !== match.team2)}
        canClick={canPick && bothTeams && !!match.team2}
        onClick={() => match.team2 && onPick(stage, match.slot, match.team2)}
      />
    </div>
  );
}

function RoundSection({
  label,
  stage,
  matches,
  picks,
  canPick,
  onPick,
  cols = 2,
}: {
  label: string;
  stage: string;
  matches: MatchData[];
  picks: Picks;
  canPick: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
  cols?: 1 | 2;
}) {
  const filled = matches.filter(m => picks[`${stage}:${m.slot}`]).length;
  const total = matches.length;

  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-black uppercase tracking-[0.2em] text-green-400">{label}</span>
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
        <span className="text-white/25 text-[11px] font-medium tabular-nums">
          {filled}/{total}
        </span>
      </div>
      <div className={cols === 2 ? "grid grid-cols-2 gap-2" : "flex justify-center"}>
        {cols === 2
          ? matches.map(m => (
              <MatchCard
                key={m.slot}
                match={m}
                stage={stage}
                winner={picks[`${stage}:${m.slot}`]}
                canPick={canPick}
                onPick={onPick}
              />
            ))
          : matches.map(m => (
              <div key={m.slot} className="w-full max-w-xs">
                <MatchCard
                  match={m}
                  stage={stage}
                  winner={picks[`${stage}:${m.slot}`]}
                  canPick={canPick}
                  onPick={onPick}
                />
              </div>
            ))}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="h-px mb-10"
      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }}
    />
  );
}

// Segmented control to switch between the bracket tree, the round-by-round list,
// and the toddler-friendly Baby Mode.
function ViewToggle({ view, onChange }: { view: BracketView; onChange: (v: BracketView) => void }) {
  return (
    <div className="mb-8 flex justify-center">
      <div className="inline-flex items-center gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
        {([
          ["tree", "Bracket"],
          ["list", "List"],
          ["baby", "Baby Mode"],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-widest transition-colors ${view === v ? "text-green-950" : "text-white/50 hover:text-white"}`}
            style={{ background: view === v ? "#fbbf24" : "transparent" }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Baby Mode — a dead-simple picking interface for a toddler. Every ready match is one
// row of two huge tappable flag cards (flag + country name). Tap a flag to make that
// team the winner; the pick lights up green. Later rounds appear as their feeder
// picks get made. Big targets, no bracket lines, no small text.
function BabyMode({
  rounds,
  finalMatch,
  picks,
  canPick,
  onPick,
}: {
  rounds: TreeRound[];
  finalMatch: TreeMatch;
  picks: Picks;
  canPick: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
}) {
  const allRounds: TreeRound[] = [...rounds, { stage: "final", label: "The Final", matches: [finalMatch] }];
  const readyRounds = allRounds
    .map((r) => ({ ...r, matches: r.matches.filter((m) => m.team1 && m.team2) }))
    .filter((r) => r.matches.length > 0);

  const BigTeam = ({ stage, slot, teamId, picked, faded }: {
    stage: string; slot: string; teamId?: string; picked: boolean; faded: boolean;
  }) => {
    const team = teamId ? getTeam(teamId) : undefined;
    if (!team) {
      return (
        <div className="flex-1 flex items-center justify-center rounded-3xl p-6 min-h-[8.5rem]" style={{ background: "rgba(255,255,255,0.03)", border: "3px dashed rgba(255,255,255,0.1)" }}>
          <span className="text-white/25 text-lg font-bold italic">TBD</span>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={canPick ? () => onPick(stage, slot, team.id) : undefined}
        disabled={!canPick}
        className={`flex-1 flex flex-col items-center justify-center gap-3 rounded-3xl p-5 sm:p-6 min-h-[8.5rem] transition-all ${canPick ? "cursor-pointer active:scale-[0.97]" : "cursor-default"}`}
        style={{
          background: picked ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.05)",
          border: picked ? "3px solid #4ade80" : "3px solid rgba(255,255,255,0.1)",
          opacity: faded ? 0.4 : 1,
        }}
      >
        <FlagIcon cc={team.cc} name={team.name} className="w-28 h-[76px] sm:w-36 sm:h-24 rounded-xl shadow-lg" />
        <span className="text-lg sm:text-2xl font-black text-white text-center leading-tight">{team.name}</span>
        {picked && <span className="text-3xl leading-none">✅</span>}
      </button>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">👶</div>
        <h3 className="font-black uppercase text-yellow-300 leading-none mb-2" style={{ fontSize: "clamp(1.6rem, 5vw, 2.2rem)" }}>Baby Mode</h3>
        <p className="text-white/60 text-base font-semibold">Tap a flag to pick who wins! 🏆</p>
      </div>

      {readyRounds.map((round) => (
        <div key={round.stage} className="mb-10">
          <div className="text-center text-yellow-300/80 font-black uppercase tracking-[0.2em] text-sm mb-4">{round.label}</div>
          <div className="space-y-4">
            {round.matches.map((m) => {
              const winner = picks[`${round.stage}:${m.slot}`];
              return (
                <div key={m.slot} className="flex items-stretch gap-2 sm:gap-3">
                  <BigTeam stage={round.stage} slot={m.slot} teamId={m.team1} picked={winner === m.team1} faded={!!winner && winner !== m.team1} />
                  <div className="flex items-center justify-center shrink-0 w-7 text-white/30 font-black text-base">vs</div>
                  <BigTeam stage={round.stage} slot={m.slot} teamId={m.team2} picked={winner === m.team2} faded={!!winner && winner !== m.team2} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// One half of a live R32 matchup: the source slot ("Winner · Group A", "3rd · Group
// E/F/G…") plus the team currently occupying it, or a placeholder while it forms.
function LiveSlot({
  qualifier,
  detail,
  teamId,
  locked,
  isWinner,
  isDimmed,
  canClick,
  onClick,
}: {
  qualifier: string;
  detail: string;
  teamId?: string;
  locked?: boolean;
  isWinner: boolean;
  isDimmed: boolean;
  canClick: boolean;
  onClick: () => void;
}) {
  const team = teamId ? getTeam(teamId) : undefined;

  return (
    <button
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-all ${canClick ? "cursor-pointer hover:bg-white/[0.06]" : "cursor-default"}`}
      style={{ background: isWinner ? "rgba(74,222,128,0.13)" : undefined }}
    >
      {team ? (
        <>
          <FlagIcon cc={team.cc} name={team.name} className={`w-6 h-[17px] rounded-sm shrink-0 transition-opacity ${isDimmed ? "opacity-25" : ""}`} />
          <div className="min-w-0 flex-1">
            <span className={`block truncate text-xs font-semibold leading-tight transition-colors ${isWinner ? "text-green-300" : isDimmed ? "text-white/25" : "text-white/85"}`}>{team.name}</span>
            <span className={`block text-[9px] font-bold uppercase tracking-wider leading-tight ${isDimmed ? "text-white/15" : "text-green-400/70"}`}>{qualifier} · {detail}</span>
          </div>
          {!isDimmed && (
            locked ? (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider"
                style={{ background: "rgba(74,222,128,0.14)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}
                title="Mathematically guaranteed this spot"
              >
                Locked
              </span>
            ) : (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider"
                style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.28)" }}
                title="Currently in this spot, but not yet clinched"
              >
                Likely
              </span>
            )
          )}
          {isWinner && <span className="text-green-400 text-[10px] font-black shrink-0">✓</span>}
        </>
      ) : (
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] italic leading-tight text-white/25">Awaiting results</span>
          <span className="block text-[9px] font-bold uppercase tracking-wider leading-tight text-white/20">{qualifier} · {detail}</span>
        </div>
      )}
    </button>
  );
}

// Drop only the picks that have become *provably* invalid, leaving the rest of the
// bracket intact. A pick is provably invalid when the team it advanced is no longer
// one of the two teams that can be in that match — and we can only know that once
// both contestants are actually KNOWN.
//
// Critically, an UNKNOWN contestant (standings not loaded yet, or a third-placed
// team not yet assigned) is NOT proof the pick is wrong. The old version treated
// "unknown" the same as "changed", so a slow or empty /api/results read resolved
// every R32 slot to undefined and deleted the player's entire bracket — which was
// then persisted to the DB. Never delete on an unresolved slot.
//
// Walks the rounds in order so a single genuine change still cascades downstream:
// when a feeder pick is removed, the pick that advanced that now-gone team goes too.
function sanitizePractice(r32: MatchData[], raw: Picks): Picks {
  const p = { ...raw };
  const removed = new Set<string>();
  const drop = (key: string) => { delete p[key]; removed.add(key); };

  // R32 — judged against the live-resolved matchup, but only when it's fully known.
  for (let i = 0; i < 16; i++) {
    const key = `r32:m${i + 1}`;
    const w = p[key];
    if (!w) continue;
    const t1 = r32[i]?.team1;
    const t2 = r32[i]?.team2;
    if (w === t1 || w === t2) continue;  // still a valid contestant — keep
    if (t1 && t2) drop(key);             // both known and ours is neither → gone
    // else: at least one side unknown — can't prove it's wrong, so keep it.
  }

  // Later rounds — the two contestants are the player's own feeder picks. A pick is
  // invalid only when it matches neither feeder winner AND we can prove it: either
  // both feeders are decided, or a feeder was just removed (so the team this pick
  // advanced is no longer in the bracket).
  const prune = (key: string, f1: string, f2: string) => {
    const w = p[key];
    if (!w) return;
    if (w === p[f1] || w === p[f2]) return;  // still matches a surviving feeder winner
    if ((p[f1] && p[f2]) || removed.has(f1) || removed.has(f2)) drop(key);
  };
  for (let i = 0; i < 8; i++) prune(`r16:m${i + 1}`, `r32:m${2 * i + 1}`, `r32:m${2 * i + 2}`);
  for (let i = 0; i < 4; i++) prune(`qf:m${i + 1}`, `r16:m${2 * i + 1}`, `r16:m${2 * i + 2}`);
  SF_QF_FEEDERS.forEach(([a, b], i) => prune(`sf:m${i + 1}`, `qf:m${a}`, `qf:m${b}`));
  prune("final:m1", "sf:m1", "sf:m2");
  return p;
}

// Live, saved bracket shown while the group stage is finishing. The Round of 32 is
// built from the current group standings (third-placed teams resolved via FIFA's
// Annex C once the group stage completes); from there players advance teams round by
// round. Picks are saved for real. As results land, any pick whose team no longer
// holds its slot (a "likely" qualifier that got overtaken) is cleared automatically
// so the player can pick again.
function LiveRoundOf32({
  results,
  standings,
  picks: rawPicks,
  canPick = true,
  onPick,
}: {
  results: ResultEntry[];
  standings: StandingRow[];
  picks: Picks;
  canPick?: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
}) {
  const [view, setView] = useState<BracketView>("tree");
  const thirdAssign = useMemo(() => computeThirdAssign(results, standings), [results, standings]);
  const complete = useMemo(() => groupStageComplete(results, standings), [results, standings]);
  const locks = useMemo(() => computeGroupLocks(standings, complete), [standings, complete]);

  // Resolve R32 once (depends on results + third assignment) for sanitizing + render.
  const r32resolved = useMemo(() => {
    const rm = new Map(results.map((r) => [`${r.stage}:${r.slot}`, r.team_id]));
    return resolveR32(rm, thirdAssign);
  }, [results, thirdAssign]);
  const r32data: MatchData[] = r32resolved.map((m) => ({ slot: m.slot, team1: m.team1, team2: m.team2 }));

  // Render against a sanitized view so a just-invalidated pick disappears immediately,
  // before the server round-trip below removes it for good.
  const picks = useMemo(() => sanitizePractice(r32data, rawPicks), [r32data, rawPicks]);

  // Persist the removal of any saved knockout pick the live bracket just invalidated.
  const invalidKeys = useMemo(
    () => Object.keys(rawPicks).filter((k) => KNOCKOUT_KEYS.has(k.split(":")[0]) && !(k in picks)),
    [rawPicks, picks],
  );
  useEffect(() => {
    if (!canPick) return; // bracket frozen for this player — never mutate their picks
    invalidKeys.forEach((k) => {
      const [s, sl] = k.split(":");
      onPick(s, sl, "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidKeys.join("|"), canPick]);

  const pick = (stage: string, slot: string, teamId: string) => onPick(stage, slot, teamId);

  // Whether the team in an R32 slot is mathematically locked into it or just the
  // current ("likely") leader — surfaced as a color in the bracket tree.
  const teamLock = (stage: string, slot: string, teamId?: string): "locked" | "likely" | undefined => {
    if (stage !== "r32" || !teamId) return undefined;
    const rm = r32resolved.find((x) => x.slot === slot);
    if (!rm) return undefined;
    const src = rm.team1 === teamId ? rm.home : rm.team2 === teamId ? rm.away : undefined;
    if (!src) return undefined;
    return sourceLocked(src, locks, thirdAssign, complete) ? "locked" : "likely";
  };

  const { r16, qf, sf, finalMatch } = buildBracket(results, picks, thirdAssign);
  const champion = picks["final:m1"];
  const championTeam = champion ? getTeam(champion) : undefined;

  // Overall pick progress across the whole bracket: 16 + 8 + 4 + 2 + 1 = 31 picks.
  const TOTAL_PICKS = 31;
  const madePicks = ["r32", "r16", "qf", "sf", "final"].reduce(
    (n, st) => n + Object.keys(picks).filter((k) => k.startsWith(`${st}:`)).length,
    0,
  );
  const pickPct = Math.round((madePicks / TOTAL_PICKS) * 100);
  const bracketComplete = !!picks["final:m1"];
  const hasPicks = madePicks > 0;

  const resetPicks = () => {
    Object.keys(picks).forEach((k) => {
      const [s, sl] = k.split(":");
      if (KNOCKOUT_KEYS.has(s)) onPick(s, sl, "");
    });
  };

  const treeRounds: TreeRound[] = [
    { stage: "r32", label: "R32", matches: r32data },
    { stage: "r16", label: "R16", matches: r16 },
    { stage: "qf", label: "QF", matches: qf },
    { stage: "sf", label: "SF", matches: sf },
  ];

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}
    >
      <div className={`${view === "tree" ? "max-w-5xl" : "max-w-2xl"} mx-auto px-4 pt-10 pb-24`}>

        {/* Header */}
        <div className="mb-8 text-center">
          {canPick ? (
            <div className="inline-flex items-center gap-2 mb-4 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest"
              style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.35)", color: "#4ade80" }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              Live Bracket
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 mb-4 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest"
              style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24" }}>
              🔒 Bracket Locked
            </div>
          )}
          <p className="font-black uppercase leading-none text-white mb-1" style={{ fontSize: "clamp(1.9rem, 6vw, 2.6rem)", letterSpacing: "-0.02em" }}>Your</p>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-300/60" />
            <h2 className="font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(1.9rem, 6vw, 2.6rem)", letterSpacing: "-0.02em" }}>
              Bracket
            </h2>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-300/60" />
          </div>
          <p className="text-white/55 text-sm mt-3 max-w-md mx-auto leading-relaxed">
            {canPick ? (
              <>The Round of 32 is built live from the current group standings according to official 2026 FIFA rules. Pick your way through — <span className="text-white/80 font-semibold">your bracket is saved automatically</span>. As results come in, any pick whose team no longer holds its spot is cleared so you can pick again.</>
            ) : (
              <>Your bracket is <span className="text-yellow-300/90 font-semibold">locked in</span> — review your picks below, but they can no longer be changed.</>
            )}
          </p>
        </div>

        {/* Progress — overall bracket completion */}
        <div className="mb-8 text-center">
          <p className={`text-sm font-bold mb-2.5 ${bracketComplete ? "text-green-400" : "text-white"}`}>
            {bracketComplete
              ? "🏆 Bracket complete — champion crowned!"
              : <>
                  <span className="text-green-400 tabular-nums">{madePicks}</span>
                  <span className="text-white/60"> of {TOTAL_PICKS} picks made</span>
                </>}
          </p>
          <div className="h-1.5 rounded-full overflow-hidden max-w-xs mx-auto" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pickPct}%`, background: bracketComplete ? "#4ade80" : "#fbbf24" }} />
          </div>
          {!thirdAssign ? (
            <p className="text-white/35 text-[11px] mt-2">Third-placed qualifiers appear once every group has kicked off.</p>
          ) : !complete ? (
            <p className="text-white/35 text-[11px] mt-2">Third-placed qualifiers are provisional — they&apos;ll shift as group results come in.</p>
          ) : null}
          {hasPicks && canPick && (
            <button
              onClick={resetPicks}
              className="mt-4 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white/50 transition-colors hover:text-white"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              ↺ Reset picks
            </button>
          )}
        </div>

        <ViewToggle view={view} onChange={setView} />

        {view === "tree" && (
          <BracketTree rounds={treeRounds} finalMatch={finalMatch} picks={picks} canPick={canPick} onPick={pick} teamLock={teamLock} championKicker="Your" />
        )}

        {view === "baby" && (
          <BabyMode rounds={treeRounds} finalMatch={finalMatch} picks={picks} canPick={canPick} onPick={pick} />
        )}

        {view === "list" && (<>
        {/* Live, interactive Round of 32 */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-green-400">Round of 32</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-white/25 text-[11px] font-medium tabular-nums">{r32resolved.filter(m => picks[`r32:${m.slot}`]).length}/16</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {r32resolved.map((m: ResolvedMatch, i) => {
              const ready = !!(m.team1 && m.team2);
              const winner = picks[`r32:${m.slot}`];
              const homeLabel = sourceLabel(m.home, thirdAssign);
              const awayLabel = sourceLabel(m.away, thirdAssign);
              return (
                <div
                  key={m.slot}
                  className="rounded-xl overflow-hidden transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: winner ? "1px solid rgba(74,222,128,0.22)" : ready ? "1px solid rgba(74,222,128,0.14)" : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="flex items-center justify-between px-2.5 pt-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/25">Match {i + 1}</span>
                    {canPick && ready && !winner && <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Tap to pick</span>}
                  </div>
                  <LiveSlot qualifier={homeLabel.qualifier} detail={homeLabel.detail} teamId={m.team1} locked={sourceLocked(m.home, locks, thirdAssign, complete)} isWinner={winner === m.team1} isDimmed={!!(winner && winner !== m.team1)} canClick={canPick && ready && !!m.team1} onClick={() => m.team1 && pick("r32", m.slot, m.team1)} />
                  <div className="mx-2.5 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <LiveSlot qualifier={awayLabel.qualifier} detail={awayLabel.detail} teamId={m.team2} locked={sourceLocked(m.away, locks, thirdAssign, complete)} isWinner={winner === m.team2} isDimmed={!!(winner && winner !== m.team2)} canClick={canPick && ready && !!m.team2} onClick={() => m.team2 && pick("r32", m.slot, m.team2)} />
                </div>
              );
            })}
          </div>
        </div>

        <Divider />
        <RoundSection label="Round of 16" stage="r16" matches={r16} picks={picks} canPick={canPick} onPick={pick} cols={2} />
        <Divider />
        <RoundSection label="Quarterfinals" stage="qf" matches={qf} picks={picks} canPick={canPick} onPick={pick} cols={2} />
        <Divider />
        <RoundSection label="Semifinals" stage="sf" matches={sf} picks={picks} canPick={canPick} onPick={pick} cols={2} />
        <Divider />
        <RoundSection label="The Final" stage="final" matches={[finalMatch]} picks={picks} canPick={canPick} onPick={pick} cols={1} />

        {/* Champion */}
        <div className="mt-4 text-center">
          <div className="h-px bg-gradient-to-r from-transparent via-yellow-300/30 to-transparent mb-10" />
          <p className="text-white/35 font-black uppercase tracking-[0.25em] text-xs mb-1">Your</p>
          <h3 className="font-black uppercase text-yellow-300 mb-8 leading-none" style={{ fontSize: "clamp(2rem, 6vw, 2.8rem)", letterSpacing: "-0.01em" }}>Champion</h3>
          {championTeam ? (
            <div className="inline-flex flex-col items-center gap-4 rounded-2xl px-12 py-8 mx-auto" style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.28)" }}>
              <span className="text-5xl">🏆</span>
              <FlagIcon cc={championTeam.cc} name={championTeam.name} className="w-20 h-14 rounded-lg shadow-2xl" />
              <span className="font-black text-white text-2xl leading-tight">{championTeam.name}</span>
            </div>
          ) : (
            <div className="inline-flex flex-col items-center gap-3 rounded-2xl px-10 py-8 mx-auto" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-5xl opacity-15">🏆</span>
              <p className="text-white/25 text-sm">Play it out to crown your champion</p>
            </div>
          )}
        </div>
        </>)}

      </div>
    </div>
  );
}

export function BracketPicker({ picks, results, standings, phase, preview, locked = false, onPick }: Props) {
  const canPick = phase === "phase2_open" && !locked;
  const [view, setView] = useState<BracketView>("tree");
  const thirdAssign = useMemo(() => computeThirdAssign(results, standings), [results, standings]);
  const { r32, r16, qf, sf, finalMatch } = buildBracket(results, picks, thirdAssign);
  const champion = picks["final:m1"];
  const championTeam = champion ? getTeam(champion) : undefined;

  const treeRounds: TreeRound[] = [
    { stage: "r32", label: "R32", matches: r32 },
    { stage: "r16", label: "R16", matches: r16 },
    { stage: "qf", label: "QF", matches: qf },
    { stage: "sf", label: "SF", matches: sf },
  ];

  if (phase === "phase1_open" || phase === "phase1_locked") {
    return <LiveRoundOf32 results={results} standings={standings} picks={picks} canPick={!locked} onPick={onPick} />;
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}
    >
      <div className={`${view === "tree" ? "max-w-5xl" : "max-w-2xl"} mx-auto px-4 pt-10 pb-24`}>

        {/* Page header */}
        <div className="mb-10 text-center">
          <p className="font-black uppercase leading-none text-white mb-1" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>The</p>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-300/60" />
            <h2 className="font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>
              Bracket
            </h2>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-300/60" />
          </div>
          {preview && (
            <div className="inline-flex items-center gap-2 mt-3 rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
              ⚙ Preview — mock bracket
            </div>
          )}
          {!preview && (canPick ? (
            <p className="text-white/60 text-sm mt-3">Click a team to pick them as the match winner — they advance to the next round.</p>
          ) : (
            <p className="text-white/40 text-sm mt-3">Bracket picks are locked.</p>
          ))}
        </div>

        <ViewToggle view={view} onChange={setView} />

        {view === "tree" && (
          <BracketTree rounds={treeRounds} finalMatch={finalMatch} picks={picks} canPick={canPick} onPick={onPick} />
        )}

        {view === "baby" && (
          <BabyMode rounds={treeRounds} finalMatch={finalMatch} picks={picks} canPick={canPick} onPick={onPick} />
        )}

        {view === "list" && (<>
        <RoundSection label="Round of 32" stage="r32" matches={r32} picks={picks} canPick={canPick} onPick={onPick} cols={2} />
        <Divider />
        <RoundSection label="Round of 16" stage="r16" matches={r16} picks={picks} canPick={canPick} onPick={onPick} cols={2} />
        <Divider />
        <RoundSection label="Quarterfinals" stage="qf" matches={qf} picks={picks} canPick={canPick} onPick={onPick} cols={2} />
        <Divider />
        <RoundSection label="Semifinals" stage="sf" matches={sf} picks={picks} canPick={canPick} onPick={onPick} cols={2} />
        <Divider />
        <RoundSection label="The Final" stage="final" matches={[finalMatch]} picks={picks} canPick={canPick} onPick={onPick} cols={1} />

        {/* Champion */}
        <div className="mt-4 text-center">
          <div className="h-px bg-gradient-to-r from-transparent via-yellow-300/30 to-transparent mb-10" />
          <p className="text-white/35 font-black uppercase tracking-[0.25em] text-xs mb-1">Your</p>
          <h3
            className="font-black uppercase text-yellow-300 mb-8 leading-none"
            style={{ fontSize: "clamp(2rem, 6vw, 2.8rem)", letterSpacing: "-0.01em" }}
          >
            Champion
          </h3>

          {championTeam ? (
            <div
              className="inline-flex flex-col items-center gap-4 rounded-2xl px-12 py-8 mx-auto"
              style={{
                background: "rgba(251,191,36,0.07)",
                border: "1px solid rgba(251,191,36,0.28)",
              }}
            >
              <span className="text-5xl">🏆</span>
              <FlagIcon cc={championTeam.cc} name={championTeam.name} className="w-20 h-14 rounded-lg shadow-2xl" />
              <span className="font-black text-white text-2xl leading-tight">{championTeam.name}</span>
            </div>
          ) : (
            <div
              className="inline-flex flex-col items-center gap-3 rounded-2xl px-10 py-8 mx-auto"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span className="text-5xl opacity-15">🏆</span>
              <p className="text-white/25 text-sm">Pick a Final winner to crown your champion</p>
            </div>
          )}
        </div>
        </>)}

      </div>
    </div>
  );
}
