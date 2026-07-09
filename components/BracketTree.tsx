"use client";

import { useEffect, useRef, useState } from "react";
import { getTeam } from "@/lib/data";
import { FlagIcon } from "@/components/FlagIcon";

type Picks = Record<string, string>;

export interface TreeMatch {
  slot: string;
  team1?: string;
  team2?: string;
}

export interface TreeRound {
  stage: string; // r32 | r16 | qf | sf
  label: string; // short column label
  matches: TreeMatch[]; // in bracket order (left half first, right half second)
}

type LockState = "locked" | "likely";

interface Props {
  rounds: TreeRound[]; // exactly the four feeder rounds: r32, r16, qf, sf
  finalMatch: TreeMatch;
  picks: Picks;
  canPick: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
  championKicker?: string; // small label above "Champion" (e.g. "Your", "Practice")
  // Optional certainty of the team in a slot (R32 only): "locked" = clinched, "likely"
  // = current leader but not yet certain. Surfaced as a left color accent + a legend.
  teamLock?: (stage: string, slot: string, teamId?: string) => LockState | undefined;
  // When provided, tapping any team (regardless of canPick) invokes this instead of
  // advancing them — used by the read-only real-results bracket to open a team's
  // match history. Picking mode leaves this undefined and behaves as before.
  onTeamClick?: (teamId: string) => void;
  // Placeholder shown under "Champion" before the Final is decided.
  championPendingText?: string;
  // Optional kickoff label for an upcoming (not-yet-decided) fixture, keyed by its
  // bracket slot so it works even before the two teams are known (TBD fixtures).
  // When it returns a string it's shown as small text above the node. Used by the
  // real-results bracket to surface scheduled fixture dates/times.
  matchTime?: (stage: string, slot: string) => string | undefined;
}

const LOCK_COLOR: Record<LockState, string> = { locked: "#4ade80", likely: "#fbbf24" };

// One team's row inside a bracket node. Clicking advances them (when allowed).
function TeamRow({
  teamId,
  isWinner,
  isDimmed,
  isFinal,
  lock,
  canClick,
  onClick,
  onTeamClick,
}: {
  teamId?: string;
  isWinner: boolean;
  isDimmed: boolean;
  isFinal: boolean;
  lock?: LockState;
  canClick: boolean;
  onClick: () => void;
  // Read-only history click (see BracketTree props). Takes precedence over picking.
  onTeamClick?: () => void;
}) {
  const team = teamId ? getTeam(teamId) : undefined;
  const rowClick = onTeamClick ?? (canClick ? onClick : undefined);
  const clickable = !!rowClick;
  // The winner highlight doubles as the certainty cue: green when the advanced team
  // is locked into its slot, amber when it's only the "likely" (not-yet-clinched)
  // pick. The Final is always gold.
  const amber = isWinner && !isFinal && lock === "likely";
  const winColor = isFinal || amber ? "#fbbf24" : "#4ade80";
  const winBg = isWinner ? (isFinal || amber ? "rgba(251,191,36,0.16)" : "rgba(74,222,128,0.14)") : undefined;
  return (
    <button
      type="button"
      onClick={rowClick}
      disabled={!clickable}
      title={team?.name}
      className={`flex w-full items-center gap-2.5 px-3 py-3.5 text-left transition-colors sm:gap-2 sm:px-2.5 sm:py-2 ${clickable ? "cursor-pointer hover:bg-white/[0.07]" : "cursor-default"}`}
      style={{ background: winBg }}
    >
      {team ? (
        <>
          <FlagIcon cc={team.cc} name={team.name} className={`h-[19px] w-[28px] shrink-0 rounded-[2px] sm:h-3.5 sm:w-[21px] ${isDimmed ? "opacity-25" : ""}`} />
          <span
            className="min-w-0 flex-1 truncate text-[17px] font-bold leading-tight sm:text-[12px]"
            style={{ color: isWinner ? winColor : isDimmed ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.82)" }}
          >
            {team.name}
          </span>
          {isWinner && <span className="shrink-0 text-[16px] font-black sm:text-[11px]" style={{ color: winColor }}>✓</span>}
        </>
      ) : (
        <span className="text-[16px] italic text-white/20 sm:text-[11px]">TBD</span>
      )}
    </button>
  );
}

// A single match node (two stacked team rows).
function Node({
  match,
  stage,
  picks,
  canPick,
  onPick,
  teamLock,
  onTeamClick,
  isFinal = false,
}: {
  match: TreeMatch;
  stage: string;
  picks: Picks;
  canPick: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
  teamLock?: (stage: string, slot: string, teamId?: string) => LockState | undefined;
  onTeamClick?: (teamId: string) => void;
  isFinal?: boolean;
}) {
  const winner = picks[`${stage}:${match.slot}`];
  const ready = !!(match.team1 && match.team2);
  const clickable = canPick && ready;
  // Border echoes the winner's certainty: gold for the Final, amber for a "likely"
  // advanced team, green for a locked one.
  const amberWin = !isFinal && !!winner && teamLock?.(stage, match.slot, winner) === "likely";
  const accent = isFinal
    ? "rgba(251,191,36,0.45)"
    : winner
      ? (amberWin ? "rgba(251,191,36,0.4)" : "rgba(74,222,128,0.3)")
      : ready
        ? "rgba(74,222,128,0.16)"
        : "rgba(255,255,255,0.09)";
  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${accent}` }}
    >
      <TeamRow
        teamId={match.team1}
        isWinner={!!winner && winner === match.team1}
        isDimmed={!!(winner && winner !== match.team1)}
        isFinal={isFinal}
        lock={teamLock?.(stage, match.slot, match.team1)}
        canClick={clickable && !!match.team1}
        onClick={() => match.team1 && onPick(stage, match.slot, match.team1)}
        onTeamClick={onTeamClick && match.team1 ? () => onTeamClick(match.team1!) : undefined}
      />
      <div className="mx-1.5 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
      <TeamRow
        teamId={match.team2}
        isWinner={!!winner && winner === match.team2}
        isDimmed={!!(winner && winner !== match.team2)}
        isFinal={isFinal}
        lock={teamLock?.(stage, match.slot, match.team2)}
        canClick={clickable && !!match.team2}
        onClick={() => match.team2 && onPick(stage, match.slot, match.team2)}
        onTeamClick={onTeamClick && match.team2 ? () => onTeamClick(match.team2!) : undefined}
      />
    </div>
  );
}

// One column of a side: a label on top and the round's matches spaced evenly. The
// `mirror` flag (right half) flips text back upright after the side-level scaleX(-1).
function RoundColumn({
  round,
  picks,
  canPick,
  onPick,
  teamLock,
  onTeamClick,
  matchTime,
  mirror,
}: {
  round: TreeRound;
  picks: Picks;
  canPick: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
  teamLock?: (stage: string, slot: string, teamId?: string) => LockState | undefined;
  onTeamClick?: (teamId: string) => void;
  matchTime?: (stage: string, slot: string) => string | undefined;
  mirror: boolean;
}) {
  const flip = mirror ? { transform: "scaleX(-1)" } : undefined;
  const labelFlip = mirror ? { display: "inline-block", transform: "scaleX(-1)" } : undefined;
  return (
    <div className="wcbt-round">
      <div className="wcbt-rlabel"><span style={labelFlip}>{round.label}</span></div>
      <div className="wcbt-games">
        {round.matches.map((m) => {
          const decided = !!picks[`${round.stage}:${m.slot}`];
          // Kickoff for any not-yet-decided fixture — including TBD ones whose teams
          // aren't known yet (keyed by slot, so it doesn't need the two teams).
          const kickoff = decided ? undefined : matchTime?.(round.stage, m.slot);
          return (
            <div key={m.slot} className={`wcbt-game${decided ? " wcbt-won" : ""}`}>
              <div className="wcbt-cell">
                {kickoff && <div className="wcbt-kick"><span style={labelFlip}>{kickoff}</span></div>}
                <div style={flip}>
                  <Node match={m} stage={round.stage} picks={picks} canPick={canPick} onPick={onPick} teamLock={teamLock} onTeamClick={onTeamClick} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Classic two-sided knockout tree: both halves converge on the Final in the middle,
// with a festive champion spot beneath. Horizontally scrollable on small screens,
// fully visible on desktop. Interactive — tap a team to send them through.
export function BracketTree({ rounds, finalMatch, picks, canPick, onPick, championKicker = "Your", teamLock, onTeamClick, championPendingText = "Play it out to crown a champion", matchTime }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ moved: false });
  const [pannable, setPannable] = useState(false);

  // Only show the grab cursor / drag affordance when there's actually overflow.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setPannable(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => { ro.disconnect(); window.removeEventListener("resize", check); };
  }, []);

  // Click-and-drag to pan (mouse only — touch keeps native momentum scrolling). A
  // 4px threshold distinguishes a pan from a tap, and onClickCapture swallows the
  // click that follows a drag so it doesn't accidentally pick a team.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const rect = el.getBoundingClientRect();
    if (e.clientY > rect.bottom - 14) return; // let the native scrollbar handle its own drag
    const startX = e.clientX;
    const startLeft = el.scrollLeft;
    drag.current.moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!drag.current.moved && Math.abs(dx) < 4) return;
      drag.current.moved = true;
      el.scrollLeft = startLeft - dx;
      el.classList.add("wcbt-grabbing");
      ev.preventDefault();
    };
    const up = () => {
      el.classList.remove("wcbt-grabbing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      drag.current.moved = false;
    }
  };

  // Split each round down the middle: first half feeds the left side, second the right.
  const left: TreeRound[] = rounds.map((r) => ({ ...r, matches: r.matches.slice(0, Math.ceil(r.matches.length / 2)) }));
  const right: TreeRound[] = rounds.map((r) => ({ ...r, matches: r.matches.slice(Math.ceil(r.matches.length / 2)) }));

  const champion = picks[`final:${finalMatch.slot}`];
  const championTeam = champion ? getTeam(champion) : undefined;
  const finalDecided = !!champion;

  return (
    <div>
      <style>{CSS}</style>

      <div className="mb-2 hidden items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/35 sm:flex">
        <span>{onTeamClick ? "Tap a team to see their results" : "Tap a team to send them through"}</span>
      </div>

      {teamLock && (
        <div className="mb-3 flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-wider text-white/40">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ background: "rgba(74,222,128,0.16)", border: `1px solid ${LOCK_COLOR.locked}` }} />
            Locked in
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ background: "rgba(251,191,36,0.16)", border: `1px solid ${LOCK_COLOR.likely}` }} />
            Likely (may change)
          </span>
        </div>
      )}

      <div
        ref={scrollRef}
        className={`wcbt-wrap${pannable ? " wcbt-pannable" : ""}`}
        onPointerDown={onPointerDown}
        onClickCapture={onClickCapture}
      >
        <div className="wcbt-row">
          {/* Left half */}
          <div className="wcbt-side">
            {left.map((r) => (
              <RoundColumn key={`L-${r.stage}`} round={r} picks={picks} canPick={canPick} onPick={onPick} teamLock={teamLock} onTeamClick={onTeamClick} matchTime={matchTime} mirror={false} />
            ))}
          </div>

          {/* Center — the Final, with a crown that lights up once it's decided. The
              cell stays vertically centered so its connectors line up with both SFs;
              the crown sits just beneath it without pushing it off-center. */}
          <div className="wcbt-center">
            <div className="wcbt-rlabel">🏆 Final</div>
            <div className="wcbt-finalwrap">
              <div className="wcbt-finalcell">
                {!finalDecided && matchTime?.("final", finalMatch.slot) && (
                  <div className="wcbt-kick">{matchTime("final", finalMatch.slot)}</div>
                )}
                <Node match={finalMatch} stage="final" picks={picks} canPick={canPick} onPick={onPick} onTeamClick={onTeamClick} isFinal />
                <div className="wcbt-crown flex flex-col items-center gap-0.5">
                  {championTeam ? (
                    <>
                      <span className="wcbt-sparkle text-base leading-none">🏆</span>
                      <FlagIcon cc={championTeam.cc} name={championTeam.name} className="h-6 w-9 rounded shadow-lg" />
                      <span className="max-w-[90px] truncate text-center text-[11px] font-black leading-tight text-yellow-300 sm:text-[9px]">{championTeam.name}</span>
                    </>
                  ) : (
                    <span className="text-base leading-none opacity-20">🏆</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right half — same DOM order as the left, but the side is scaleX(-1)
              flipped so SF ends up next to the center and R32 on the far right. */}
          <div className="wcbt-side wcbt-mirror">
            {right.map((r) => (
              <RoundColumn key={`R-${r.stage}`} round={r} picks={picks} canPick={canPick} onPick={onPick} teamLock={teamLock} onTeamClick={onTeamClick} matchTime={matchTime} mirror />
            ))}
          </div>
        </div>
      </div>

      {/* Big champion payoff below — always visible regardless of scroll position */}
      <div className="mt-8 text-center">
        <div className="mb-8 h-px bg-gradient-to-r from-transparent via-yellow-300/30 to-transparent" />
        <p className="mb-1 text-[11px] font-black uppercase tracking-[0.25em] text-white/35">{championKicker}</p>
        <h3 className="mb-7 font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(2rem, 6vw, 2.8rem)", letterSpacing: "-0.01em" }}>
          Champion
        </h3>
        {championTeam ? (
          <div className="wcbt-champ-big relative mx-auto inline-flex flex-col items-center gap-4 overflow-hidden rounded-2xl px-12 py-8">
            <span className="wcbt-bounce text-5xl">🏆</span>
            <FlagIcon cc={championTeam.cc} name={championTeam.name} className="h-14 w-20 rounded-lg shadow-2xl" />
            <span className="text-2xl font-black leading-tight text-white">{championTeam.name}</span>
            {/* confetti */}
            {CONFETTI.map((c, i) => (
              <span key={i} className="wcbt-confetti" style={{ left: c.left, animationDelay: c.delay, color: c.color }}>{c.char}</span>
            ))}
          </div>
        ) : (
          <div className="mx-auto inline-flex flex-col items-center gap-3 rounded-2xl px-10 py-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="text-5xl opacity-15">🏆</span>
            <p className="text-sm text-white/25">{finalDecided ? "" : championPendingText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const CONFETTI = [
  { left: "8%", delay: "0s", color: "#fbbf24", char: "★" },
  { left: "22%", delay: "0.5s", color: "#4ade80", char: "●" },
  { left: "40%", delay: "0.2s", color: "#60a5fa", char: "✦" },
  { left: "60%", delay: "0.7s", color: "#f472b6", char: "●" },
  { left: "78%", delay: "0.3s", color: "#fbbf24", char: "★" },
  { left: "92%", delay: "0.6s", color: "#4ade80", char: "✦" },
];

// Connector geometry + champion animations. Scoped under .wcbt-* class names.
// Equal-height columns (align-items:stretch) + flex:1 game slots make each later
// round's nodes center exactly between their two feeders; the pseudo-element stubs
// and vertical bars draw the elbows. The right half is scaleX(-1) flipped so one set
// of left-to-right rules serves both sides.
const CSS = `
.wcbt-wrap { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; padding-bottom: 10px; scrollbar-width: thin; scrollbar-color: rgba(74,222,128,0.45) transparent; }
.wcbt-wrap::-webkit-scrollbar { height: 9px; }
.wcbt-wrap::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 999px; margin: 0 2px; }
.wcbt-wrap::-webkit-scrollbar-thumb { border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; background-color: rgba(74,222,128,0.5); background-image: linear-gradient(90deg, rgba(74,222,128,0.65), rgba(251,191,36,0.65)); transition: background-image 150ms ease; }
.wcbt-wrap::-webkit-scrollbar-thumb:hover { background-image: linear-gradient(90deg, rgba(74,222,128,0.95), rgba(251,191,36,0.95)); }
.wcbt-pannable { cursor: grab; }
.wcbt-grabbing, .wcbt-grabbing * { cursor: grabbing !important; user-select: none; }
.wcbt-row {
  display: flex; align-items: stretch; width: max-content; margin: 0 auto;
  min-height: clamp(440px, 62vh, 580px);
  --g: 18px; --node: 158px; --line: rgba(255,255,255,0.13); --line-on: rgba(74,222,128,0.6);
}
.wcbt-side { display: flex; align-items: stretch; }
.wcbt-mirror { transform: scaleX(-1); }
.wcbt-round { display: flex; flex-direction: column; }
.wcbt-rlabel { height: 18px; margin-bottom: 8px; text-align: center; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.32); white-space: nowrap; }
@media (min-width: 640px) { .wcbt-rlabel { font-size: 9px; } .wcbt-row { --node: 116px; } }
.wcbt-games { flex: 1; display: flex; flex-direction: column; }
.wcbt-game { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; padding: 0 calc(var(--g) / 2); }
.wcbt-cell { width: var(--node); position: relative; margin: 3px 0; }
/* Upcoming-fixture kickoff, floated above the node so it doesn't shift the node's
   vertical center (the connector elbows are anchored to that center at top:50%). */
.wcbt-kick { position: absolute; bottom: 100%; left: 0; right: 0; margin-bottom: 4px; text-align: center; font-size: 11px; font-weight: 700; line-height: 1.1; color: rgba(255,255,255,0.42); white-space: nowrap; pointer-events: none; }
@media (min-width: 640px) { .wcbt-kick { font-size: 9px; margin-bottom: 3px; } }

/* source stub: every node reaches toward the next round */
.wcbt-game::after { content: ""; position: absolute; right: 0; top: 50%; width: calc(var(--g) / 2); height: 2px; background: var(--line); transform: translateY(-50%); }
/* vertical bars join each pair (rounds that feed a later round) */
.wcbt-round:not(:last-child) .wcbt-games > .wcbt-game::before { content: ""; position: absolute; right: 0; width: 2px; background: var(--line); }
.wcbt-round:not(:last-child) .wcbt-games > .wcbt-game:nth-child(odd)::before { top: 50%; height: 50%; }
.wcbt-round:not(:last-child) .wcbt-games > .wcbt-game:nth-child(even)::before { bottom: 50%; height: 50%; }
/* target stub: rounds fed by a previous round reach back to the join */
.wcbt-round:not(:first-child) .wcbt-cell::before { content: ""; position: absolute; left: calc(-1 * var(--g) / 2); top: 50%; width: calc(var(--g) / 2); height: 2px; background: var(--line); transform: translateY(-50%); }
/* decided matches glow green along their outgoing path */
.wcbt-game.wcbt-won::after { background: var(--line-on); }
.wcbt-round:not(:last-child) .wcbt-games > .wcbt-game.wcbt-won::before { background: var(--line-on); }

/* center / final column */
.wcbt-center { display: flex; flex-direction: column; padding: 0 calc(var(--g) / 2); }
.wcbt-finalwrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
.wcbt-finalcell { width: calc(var(--node) + 8px); position: relative; }
.wcbt-finalcell::before { content: ""; position: absolute; left: calc(-1 * var(--g) / 2); top: 50%; width: calc(var(--g) / 2); height: 2px; background: var(--line); transform: translateY(-50%); }
.wcbt-finalcell::after { content: ""; position: absolute; right: calc(-1 * var(--g) / 2); top: 50%; width: calc(var(--g) / 2); height: 2px; background: var(--line); transform: translateY(-50%); }

/* champion bits */
.wcbt-crown { position: absolute; top: calc(100% + 10px); left: 50%; transform: translateX(-50%); width: max-content; }
.wcbt-sparkle { animation: wcbt-sparkle 2s ease-in-out infinite; }
.wcbt-champ-big { background: rgba(251,191,36,0.07); border: 1px solid rgba(251,191,36,0.3); box-shadow: 0 0 40px rgba(251,191,36,0.18); }
.wcbt-bounce { animation: wcbt-bounce 1.6s ease-in-out infinite; }
.wcbt-confetti { position: absolute; top: -14px; font-size: 12px; animation: wcbt-fall 2.6s linear infinite; opacity: 0; pointer-events: none; }
@keyframes wcbt-sparkle { 0%, 100% { transform: scale(1) rotate(-6deg); } 50% { transform: scale(1.18) rotate(6deg); } }
@keyframes wcbt-bounce { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-7px) scale(1.06); } }
@keyframes wcbt-fall { 0% { transform: translateY(0) rotate(0); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(180px) rotate(260deg); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .wcbt-sparkle, .wcbt-bounce, .wcbt-confetti { animation: none; }
  .wcbt-confetti { display: none; }
}
`;
