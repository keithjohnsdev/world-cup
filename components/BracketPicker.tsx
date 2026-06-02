"use client";

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
  onPick: (stage: string, slot: string, teamId: string) => void;
}

function buildBracket(results: ResultEntry[], picks: Picks) {
  const rm = new Map(results.map(r => [`${r.stage}:${r.slot}`, r.team_id]));

  const r32: MatchData[] = BRACKET_PAIRS.map(([g1, g2], i) => ({
    slot: `m${i + 1}`,
    team1: rm.get(`group:${g1}`),
    team2: rm.get(`runner:${g2}`),
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

export function BracketPicker({ picks, results, phase, onPick }: Props) {
  const canPick = phase === "phase2_open";
  const { r32, r16, qf, sf, finalMatch } = buildBracket(results, picks);
  const champion = picks["final:m1"];
  const championTeam = champion ? getTeam(champion) : undefined;

  if (phase === "phase1_open" || phase === "phase1_locked") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="text-5xl mb-6 opacity-30">🏆</div>
        <h3 className="text-white font-black text-2xl uppercase tracking-tight mb-3">Phase 2 — Coming Soon</h3>
        <p className="text-white/35 text-sm max-w-sm leading-relaxed">
          Once the group stage is complete, the full knockout bracket opens. You&apos;ll pick every match — Round of 32 through the Final.
        </p>
      </div>
    );
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
          {canPick ? (
            <p className="text-white/60 text-sm mt-3">Click a team to pick them as the match winner — they advance to the next round.</p>
          ) : (
            <p className="text-white/40 text-sm mt-3">Bracket picks are locked.</p>
          )}
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
