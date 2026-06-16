"use client";

import { useMemo, useState } from "react";
import { BRACKET_PAIRS } from "@/lib/bracket";
import { getTeam } from "@/lib/data";
import { FlagIcon } from "@/components/FlagIcon";

type Picks = Record<string, string>;

interface ResultEntry {
  stage: string;
  slot: string;
  team_id: string;
}

interface MatchData {
  slot: string;
  team1?: string;
  team2?: string;
}

interface Props {
  picks: Picks;
  results: ResultEntry[];
  phase: string;
  preview?: boolean;
  onPick: (stage: string, slot: string, teamId: string) => void;
}

// Decode a BRACKET_PAIRS group code into the results-map key
function decodeCode(code: string): string {
  if (code.startsWith("3")) return `third:${code.slice(1)}`;
  if (code.startsWith("2")) return `runner:${code.slice(1)}`;
  return `group:${code}`;
}

// Human-readable qualifier + group letter for a BRACKET_PAIRS code.
function decodeSlotLabel(code: string): { qualifier: string; letter: string } {
  if (code.startsWith("3")) return { qualifier: "3rd place", letter: code.slice(1) };
  if (code.startsWith("2")) return { qualifier: "Runner-up", letter: code.slice(1) };
  return { qualifier: "Winner", letter: code };
}

function buildBracket(results: ResultEntry[], picks: Picks) {
  const rm = new Map(results.map(r => [`${r.stage}:${r.slot}`, r.team_id]));

  const r32: MatchData[] = BRACKET_PAIRS.map(([g1, g2], i) => ({
    slot: `m${i + 1}`,
    team1: rm.get(decodeCode(g1)),
    team2: rm.get(decodeCode(g2)),
  }));

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

  const sf: MatchData[] = [
    { slot: "m1", team1: picks["qf:m1"], team2: picks["qf:m2"] },
    { slot: "m2", team1: picks["qf:m3"], team2: picks["qf:m4"] },
  ];

  const finalMatch: MatchData = {
    slot: "m1",
    team1: picks["sf:m1"],
    team2: picks["sf:m2"],
  };

  return { r32, r16, qf, sf, finalMatch };
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

// One half of a live R32 matchup: the source slot (e.g. "Winner · Group A")
// plus the team currently occupying it, or a placeholder while it forms.
// Clickable to advance the team in the local practice bracket.
function LiveSlot({
  code,
  teamId,
  isWinner,
  isDimmed,
  canClick,
  onClick,
}: {
  code: string;
  teamId?: string;
  isWinner: boolean;
  isDimmed: boolean;
  canClick: boolean;
  onClick: () => void;
}) {
  const team = teamId ? getTeam(teamId) : undefined;
  const { qualifier, letter } = decodeSlotLabel(code);

  return (
    <button
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-all ${canClick ? "cursor-pointer hover:bg-white/[0.06]" : "cursor-default"}`}
      style={{ background: isWinner ? "rgba(74,222,128,0.13)" : undefined }}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[10px] font-black text-white/45">
        {letter}
      </span>
      {team ? (
        <>
          <FlagIcon cc={team.cc} name={team.name} className={`w-6 h-[17px] rounded-sm shrink-0 transition-opacity ${isDimmed ? "opacity-25" : ""}`} />
          <div className="min-w-0 flex-1">
            <span className={`block truncate text-xs font-semibold leading-tight transition-colors ${isWinner ? "text-green-300" : isDimmed ? "text-white/25" : "text-white/85"}`}>{team.name}</span>
            <span className={`block text-[9px] font-bold uppercase tracking-wider leading-tight ${isDimmed ? "text-white/15" : "text-green-400/70"}`}>{qualifier}</span>
          </div>
          {isWinner && <span className="text-green-400 text-[10px] font-black shrink-0">✓</span>}
        </>
      ) : (
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] italic leading-tight text-white/25">Awaiting results</span>
          <span className="block text-[9px] font-bold uppercase tracking-wider leading-tight text-white/20">{qualifier} · Group {letter}</span>
        </div>
      )}
    </button>
  );
}

// Drop any practice pick whose stored winner is no longer one of the two teams
// actually in that match — happens when an upstream pick (or the live standings)
// changes. Walks the rounds in order so a single change cascades downstream.
function sanitizePractice(results: ResultEntry[], raw: Picks): Picks {
  const rm = new Map(results.map(r => [`${r.stage}:${r.slot}`, r.team_id]));
  const p = { ...raw };
  const keep = (key: string, t1?: string, t2?: string) => {
    const w = p[key];
    if (w && w !== t1 && w !== t2) delete p[key];
  };

  for (let i = 0; i < 16; i++) {
    const [c1, c2] = BRACKET_PAIRS[i];
    keep(`r32:m${i + 1}`, rm.get(decodeCode(c1)), rm.get(decodeCode(c2)));
  }
  for (let i = 0; i < 8; i++) keep(`r16:m${i + 1}`, p[`r32:m${2 * i + 1}`], p[`r32:m${2 * i + 2}`]);
  for (let i = 0; i < 4; i++) keep(`qf:m${i + 1}`, p[`r16:m${2 * i + 1}`], p[`r16:m${2 * i + 2}`]);
  for (let i = 0; i < 2; i++) keep(`sf:m${i + 1}`, p[`qf:m${2 * i + 1}`], p[`qf:m${2 * i + 2}`]);
  keep("final:m1", p["sf:m1"], p["sf:m2"]);
  return p;
}

// Interactive practice bracket shown during Phase 1. The Round of 32 is built live
// from the current group standings; from there players advance teams round by round
// for fun, to rehearse for when the real bracket opens in Phase 2. Picks are held in
// local state only — nothing is saved, and the server rejects knockout picks anyway.
function LiveRoundOf32({ results }: { results: ResultEntry[] }) {
  const [practice, setPractice] = useState<Picks>({});
  const picks = useMemo(() => sanitizePractice(results, practice), [results, practice]);

  const pick = (stage: string, slot: string, teamId: string) => {
    setPractice(prev => sanitizePractice(results, { ...prev, [`${stage}:${slot}`]: teamId }));
  };

  const { r32, r16, qf, sf, finalMatch } = buildBracket(results, picks);
  const champion = picks["final:m1"];
  const championTeam = champion ? getTeam(champion) : undefined;

  const codeByR32: Record<string, [string, string]> = {};
  BRACKET_PAIRS.forEach(([c1, c2], i) => { codeByR32[`m${i + 1}`] = [c1, c2]; });

  const placed = r32.flatMap(m => [m.team1, m.team2]).filter(Boolean).length;
  const formed = r32.filter(m => m.team1 && m.team2).length;
  const pct = Math.round((placed / 32) * 100);
  const hasPractice = Object.keys(practice).length > 0;

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-10 pb-24">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest"
            style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.35)", color: "#4ade80" }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            Live Practice
          </div>
          <p className="font-black uppercase leading-none text-white mb-1" style={{ fontSize: "clamp(1.9rem, 6vw, 2.6rem)", letterSpacing: "-0.02em" }}>Practice</p>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-300/60" />
            <h2 className="font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(1.9rem, 6vw, 2.6rem)", letterSpacing: "-0.02em" }}>
              Bracket
            </h2>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-300/60" />
          </div>
          <p className="text-white/55 text-sm mt-3 max-w-md mx-auto leading-relaxed">
            The Round of 32 is built live from the current group standings. Click teams to advance them and play out the whole bracket — a rehearsal for Phase 2. Nothing here is saved.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8 text-center">
          <p className="text-sm font-bold mb-2.5 text-white">
            <span className="text-green-400 tabular-nums">{placed}</span> of 32 teams in position
            <span className="text-white/35 font-medium"> · {formed}/16 R32 matchups set</span>
          </p>
          <div className="h-1.5 rounded-full overflow-hidden max-w-xs mx-auto" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "#4ade80" }} />
          </div>
          {hasPractice && (
            <button
              onClick={() => setPractice({})}
              className="mt-4 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white/50 transition-colors hover:text-white"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              ↺ Reset picks
            </button>
          )}
        </div>

        {/* Live, interactive Round of 32 */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-green-400">Round of 32</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-white/25 text-[11px] font-medium tabular-nums">{r32.filter(m => picks[`r32:${m.slot}`]).length}/16</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {r32.map((m, i) => {
              const ready = !!(m.team1 && m.team2);
              const winner = picks[`r32:${m.slot}`];
              const [c1, c2] = codeByR32[m.slot];
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
                    {ready && !winner && <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Tap to pick</span>}
                  </div>
                  <LiveSlot code={c1} teamId={m.team1} isWinner={winner === m.team1} isDimmed={!!(winner && winner !== m.team1)} canClick={ready && !!m.team1} onClick={() => m.team1 && pick("r32", m.slot, m.team1)} />
                  <div className="mx-2.5 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <LiveSlot code={c2} teamId={m.team2} isWinner={winner === m.team2} isDimmed={!!(winner && winner !== m.team2)} canClick={ready && !!m.team2} onClick={() => m.team2 && pick("r32", m.slot, m.team2)} />
                </div>
              );
            })}
          </div>
        </div>

        <Divider />
        <RoundSection label="Round of 16" stage="r16" matches={r16} picks={picks} canPick onPick={pick} cols={2} />
        <Divider />
        <RoundSection label="Quarterfinals" stage="qf" matches={qf} picks={picks} canPick onPick={pick} cols={2} />
        <Divider />
        <RoundSection label="Semifinals" stage="sf" matches={sf} picks={picks} canPick onPick={pick} cols={2} />
        <Divider />
        <RoundSection label="The Final" stage="final" matches={[finalMatch]} picks={picks} canPick onPick={pick} cols={1} />

        {/* Practice champion */}
        <div className="mt-4 text-center">
          <div className="h-px bg-gradient-to-r from-transparent via-yellow-300/30 to-transparent mb-10" />
          <p className="text-white/35 font-black uppercase tracking-[0.25em] text-xs mb-1">Practice</p>
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
              <p className="text-white/25 text-sm">Play it out to crown a practice champion</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export function BracketPicker({ picks, results, phase, preview, onPick }: Props) {
  const canPick = phase === "phase2_open";
  const { r32, r16, qf, sf, finalMatch } = buildBracket(results, picks);
  const champion = picks["final:m1"];
  const championTeam = champion ? getTeam(champion) : undefined;

  if (phase === "phase1_open" || phase === "phase1_locked") {
    return <LiveRoundOf32 results={results} />;
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-10 pb-24">

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

      </div>
    </div>
  );
}
