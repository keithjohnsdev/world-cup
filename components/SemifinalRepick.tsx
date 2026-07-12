"use client";

import { useMemo } from "react";
import { getTeam } from "@/lib/data";
import { SF_QF_FEEDERS } from "@/lib/bracket";
import { FlagIcon } from "@/components/FlagIcon";

type Picks = Record<string, string>;

interface Props {
  picks: Picks;
  // ISO deadline (window closes at the first real semifinal's kickoff).
  until: string;
  onPick: (stage: string, slot: string, teamId: string) => void;
}

// "Tue, Jul 14 · 3:00 PM" in the viewer's locale/timezone.
function fmtDeadline(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

function TeamButton({
  teamId,
  picked,
  faded,
  onClick,
}: {
  teamId?: string;
  picked: boolean;
  faded: boolean;
  onClick?: () => void;
}) {
  const team = teamId ? getTeam(teamId) : undefined;
  if (!team) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl px-4 py-5" style={{ background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(255,255,255,0.12)" }}>
        <span className="text-sm font-bold italic text-white/25">TBD</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl px-3 py-5 transition-all ${onClick ? "cursor-pointer active:scale-[0.97]" : "cursor-default"}`}
      style={{
        background: picked ? "rgba(74,222,128,0.16)" : "rgba(255,255,255,0.05)",
        border: picked ? "2px solid #4ade80" : "2px solid rgba(255,255,255,0.1)",
        opacity: faded ? 0.4 : 1,
      }}
    >
      <FlagIcon cc={team.cc} name={team.name} className="h-[52px] w-[76px] rounded-lg shadow-lg" />
      <span className="text-center text-base font-black leading-tight text-white">{team.name}</span>
      {picked && <span className="text-xl leading-none">✅</span>}
    </button>
  );
}

function MatchRow({
  label,
  stage,
  slot,
  team1,
  team2,
  winner,
  onPick,
}: {
  label: string;
  stage: string;
  slot: string;
  team1?: string;
  team2?: string;
  winner?: string;
  onPick: (stage: string, slot: string, teamId: string) => void;
}) {
  const ready = !!(team1 && team2);
  return (
    <div className="mb-6">
      <div className="mb-2 text-center text-[11px] font-black uppercase tracking-[0.2em] text-green-400/80">{label}</div>
      <div className="flex items-stretch gap-2 sm:gap-3">
        <TeamButton
          teamId={team1}
          picked={!!winner && winner === team1}
          faded={!!winner && winner !== team1}
          onClick={ready && team1 ? () => onPick(stage, slot, team1) : undefined}
        />
        <div className="flex w-7 shrink-0 items-center justify-center text-sm font-black text-white/30">vs</div>
        <TeamButton
          teamId={team2}
          picked={!!winner && winner === team2}
          faded={!!winner && winner !== team2}
          onClick={ready && team2 ? () => onPick(stage, slot, team2) : undefined}
        />
      </div>
    </div>
  );
}

// Focused "re-pick your semifinals" card, shown while the sf/final re-open window is
// open. A player's four semifinalists (their locked qf picks) are correct; this pairs
// them into the corrected semifinals (qf1·qf3, qf2·qf4) and lets them pick the winners
// and the final. Saves through the same /api/picks flow (sf/final stages).
export function SemifinalRepick({ picks, until, onPick }: Props) {
  const [sf1Feed, sf2Feed] = SF_QF_FEEDERS;

  const semis = useMemo(() => ([
    { slot: "m1", team1: picks[`qf:m${sf1Feed[0]}`], team2: picks[`qf:m${sf1Feed[1]}`] },
    { slot: "m2", team1: picks[`qf:m${sf2Feed[0]}`], team2: picks[`qf:m${sf2Feed[1]}`] },
  ]), [picks, sf1Feed, sf2Feed]);

  // The final's contestants are the player's own semifinal winners.
  const finalTeam1 = picks["sf:m1"];
  const finalTeam2 = picks["sf:m2"];

  const hasSemifinalists = semis.some((s) => s.team1 || s.team2);
  const done = !!(picks["sf:m1"] && picks["sf:m2"] && picks["final:m1"]);

  return (
    <div className="mx-auto mb-8 max-w-lg rounded-2xl px-5 py-6" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)" }}>
      <div className="mb-5 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24" }}>
          🔧 Semifinals re-opened
        </div>
        <div className="mb-2 font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(2rem, 8vw, 3rem)", letterSpacing: "-0.03em" }}>Whoops...</div>
        <h3 className="font-black uppercase leading-tight text-white" style={{ fontSize: "clamp(1.3rem, 5vw, 1.7rem)" }}>Re-pick your semifinals</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/65">
          We had the bracket&apos;s halves paired wrong — your four semifinalists are unchanged, but they line up differently than you saw. Pick who advances from <span className="font-semibold text-white/85">your</span> corrected semifinals.
        </p>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-yellow-300/80">
          Locks {fmtDeadline(until)}
        </p>
      </div>

      {hasSemifinalists ? (
        <>
          <MatchRow label="Semifinal 1" stage="sf" slot="m1" team1={semis[0].team1} team2={semis[0].team2} winner={picks["sf:m1"]} onPick={onPick} />
          <MatchRow label="Semifinal 2" stage="sf" slot="m2" team1={semis[1].team1} team2={semis[1].team2} winner={picks["sf:m2"]} onPick={onPick} />
          <MatchRow label="🏆 The Final" stage="final" slot="m1" team1={finalTeam1} team2={finalTeam2} winner={picks["final:m1"]} onPick={onPick} />
          {!finalTeam1 || !finalTeam2 ? (
            <p className="text-center text-[11px] text-white/40">Pick both semifinal winners to set your final.</p>
          ) : done ? (
            <p className="text-center text-[11px] font-bold text-green-400">✓ All set — your picks are saved.</p>
          ) : null}
        </>
      ) : (
        <p className="text-center text-sm text-white/40">Your bracket doesn&apos;t have semifinalists to re-pick.</p>
      )}
    </div>
  );
}
