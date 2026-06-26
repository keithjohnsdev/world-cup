"use client";

import { useRef } from "react";
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

interface Props {
  rounds: TreeRound[]; // exactly the four feeder rounds: r32, r16, qf, sf
  finalMatch: TreeMatch;
  picks: Picks;
  canPick: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
  championKicker?: string; // small label above "Champion" (e.g. "Your", "Practice")
}

// One team's row inside a bracket node. Clicking advances them (when allowed).
function TeamRow({
  teamId,
  isWinner,
  isDimmed,
  isFinal,
  canClick,
  onClick,
}: {
  teamId?: string;
  isWinner: boolean;
  isDimmed: boolean;
  isFinal: boolean;
  canClick: boolean;
  onClick: () => void;
}) {
  const team = teamId ? getTeam(teamId) : undefined;
  const winColor = isFinal ? "#fbbf24" : "#4ade80";
  return (
    <button
      type="button"
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      title={team?.name}
      className={`flex w-full items-center gap-1.5 px-1.5 py-1 text-left transition-colors ${canClick ? "cursor-pointer hover:bg-white/[0.07]" : "cursor-default"}`}
      style={{ background: isWinner ? (isFinal ? "rgba(251,191,36,0.16)" : "rgba(74,222,128,0.14)") : undefined }}
    >
      {team ? (
        <>
          <FlagIcon cc={team.cc} name={team.name} className={`h-3 w-[18px] shrink-0 rounded-[2px] ${isDimmed ? "opacity-25" : ""}`} />
          <span
            className="min-w-0 flex-1 truncate text-[10px] font-bold leading-tight"
            style={{ color: isWinner ? winColor : isDimmed ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.82)" }}
          >
            {team.name}
          </span>
          {isWinner && <span className="shrink-0 text-[9px] font-black" style={{ color: winColor }}>✓</span>}
        </>
      ) : (
        <span className="text-[9px] italic text-white/20">TBD</span>
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
  isFinal = false,
}: {
  match: TreeMatch;
  stage: string;
  picks: Picks;
  canPick: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
  isFinal?: boolean;
}) {
  const winner = picks[`${stage}:${match.slot}`];
  const ready = !!(match.team1 && match.team2);
  const clickable = canPick && ready;
  const accent = isFinal ? "rgba(251,191,36,0.45)" : winner ? "rgba(74,222,128,0.3)" : ready ? "rgba(74,222,128,0.16)" : "rgba(255,255,255,0.09)";
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
        canClick={clickable && !!match.team1}
        onClick={() => match.team1 && onPick(stage, match.slot, match.team1)}
      />
      <div className="mx-1.5 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
      <TeamRow
        teamId={match.team2}
        isWinner={!!winner && winner === match.team2}
        isDimmed={!!(winner && winner !== match.team2)}
        isFinal={isFinal}
        canClick={clickable && !!match.team2}
        onClick={() => match.team2 && onPick(stage, match.slot, match.team2)}
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
  mirror,
}: {
  round: TreeRound;
  picks: Picks;
  canPick: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
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
          return (
            <div key={m.slot} className={`wcbt-game${decided ? " wcbt-won" : ""}`}>
              <div className="wcbt-cell">
                <div style={flip}>
                  <Node match={m} stage={round.stage} picks={picks} canPick={canPick} onPick={onPick} />
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
export function BracketTree({ rounds, finalMatch, picks, canPick, onPick, championKicker = "Your" }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Split each round down the middle: first half feeds the left side, second the right.
  const left: TreeRound[] = rounds.map((r) => ({ ...r, matches: r.matches.slice(0, Math.ceil(r.matches.length / 2)) }));
  const right: TreeRound[] = rounds.map((r) => ({ ...r, matches: r.matches.slice(Math.ceil(r.matches.length / 2)) }));

  const champion = picks[`final:${finalMatch.slot}`];
  const championTeam = champion ? getTeam(champion) : undefined;
  const finalDecided = !!champion;

  return (
    <div>
      <style>{CSS}</style>

      <div className="mb-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
        <span className="sm:hidden">← Scroll sideways →</span>
        <span>Tap a team to send them through</span>
      </div>

      <div ref={scrollRef} className="wcbt-wrap">
        <div className="wcbt-row">
          {/* Left half */}
          <div className="wcbt-side">
            {left.map((r) => (
              <RoundColumn key={`L-${r.stage}`} round={r} picks={picks} canPick={canPick} onPick={onPick} mirror={false} />
            ))}
          </div>

          {/* Center — the Final, with a crown that lights up once it's decided. The
              cell stays vertically centered so its connectors line up with both SFs;
              the crown sits just beneath it without pushing it off-center. */}
          <div className="wcbt-center">
            <div className="wcbt-rlabel">🏆 Final</div>
            <div className="wcbt-finalwrap">
              <div className="wcbt-finalcell">
                <Node match={finalMatch} stage="final" picks={picks} canPick={canPick} onPick={onPick} isFinal />
                <div className="wcbt-crown flex flex-col items-center gap-0.5">
                  {championTeam ? (
                    <>
                      <span className="wcbt-sparkle text-base leading-none">🏆</span>
                      <FlagIcon cc={championTeam.cc} name={championTeam.name} className="h-6 w-9 rounded shadow-lg" />
                      <span className="max-w-[90px] truncate text-center text-[9px] font-black leading-tight text-yellow-300">{championTeam.name}</span>
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
              <RoundColumn key={`R-${r.stage}`} round={r} picks={picks} canPick={canPick} onPick={onPick} mirror />
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
            <p className="text-sm text-white/25">{finalDecided ? "" : "Play it out to crown a champion"}</p>
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
.wcbt-wrap { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; padding-bottom: 6px; }
.wcbt-row {
  display: flex; align-items: stretch; width: max-content; margin: 0 auto;
  min-height: clamp(440px, 62vh, 580px);
  --g: 18px; --node: 96px; --line: rgba(255,255,255,0.13); --line-on: rgba(74,222,128,0.6);
}
.wcbt-side { display: flex; align-items: stretch; }
.wcbt-mirror { transform: scaleX(-1); }
.wcbt-round { display: flex; flex-direction: column; }
.wcbt-rlabel { height: 18px; margin-bottom: 8px; text-align: center; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.32); white-space: nowrap; }
.wcbt-games { flex: 1; display: flex; flex-direction: column; }
.wcbt-game { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; padding: 0 calc(var(--g) / 2); }
.wcbt-cell { width: var(--node); position: relative; }

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
