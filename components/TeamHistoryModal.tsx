"use client";

import { useEffect } from "react";
import { getTeam } from "@/lib/data";
import { FlagIcon } from "@/components/FlagIcon";

// One real match as delivered by /api/matches (see app/api/matches/route.ts).
export interface MatchDTO {
  id: number;
  round: string;
  status: string;
  utcDate: string;
  homeTeamName: string;
  awayTeamName: string;
  homeId: string | null;
  awayId: string | null;
  winnerId: string | null;
  wasShootout: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
  homePens: number | null;
  awayPens: number | null;
}

const ROUND_LABEL: Record<string, string> = {
  "group stage": "Group Stage",
  "round of 32": "Round of 32",
  "round of 16": "Round of 16",
  "quarter-finals": "Quarterfinal",
  "semi-finals": "Semifinal",
  "third place": "3rd-Place Match",
  final: "Final",
};

function roundLabel(round: string): string {
  return ROUND_LABEL[round] ?? round.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// A team's match rendered from that team's point of view: their goals first, the
// opponent second, plus a W/L/D chip and any shootout tally.
function HistoryRow({ teamId, m }: { teamId: string; m: MatchDTO }) {
  const isHome = m.homeId === teamId;
  const oppId = isHome ? m.awayId : m.homeId;
  const oppName = isHome ? m.awayTeamName : m.homeTeamName;
  const opp = oppId ? getTeam(oppId) : undefined;

  const myG = isHome ? m.homeGoals : m.awayGoals;
  const oppG = isHome ? m.awayGoals : m.homeGoals;
  const myPen = isHome ? m.homePens : m.awayPens;
  const oppPen = isHome ? m.awayPens : m.homePens;

  const finished = m.status === "FINISHED";
  const live = m.status === "IN_PLAY" || m.status === "PAUSED";
  const result = !finished ? null : m.winnerId === teamId ? "W" : m.winnerId ? "L" : "D";
  const resultStyle =
    result === "W" ? { bg: "rgba(74,222,128,0.16)", fg: "#4ade80" } :
    result === "L" ? { bg: "rgba(248,113,113,0.14)", fg: "#f87171" } :
    { bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.55)" };

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)" }}>
      {/* Result chip / status */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black"
        style={{ background: resultStyle.bg, color: resultStyle.fg }}
      >
        {result ?? (live ? "•" : "–")}
      </div>

      {/* Opponent */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {opp ? (
            <FlagIcon cc={opp.cc} name={opp.name} className="h-3.5 w-[21px] shrink-0 rounded-[2px]" />
          ) : null}
          <span className="truncate text-sm font-bold text-white/85">
            <span className="text-white/40">vs</span> {opp?.name ?? oppName}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/35">
          {roundLabel(m.round)} · {fmtDate(m.utcDate)}
        </div>
      </div>

      {/* Scoreline */}
      <div className="shrink-0 text-right">
        {finished || live ? (
          <>
            <div className="text-base font-black leading-none text-white">
              {myG ?? 0} <span className="text-white/30">–</span> {oppG ?? 0}
            </div>
            {m.wasShootout && myPen != null && oppPen != null && (
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-yellow-300/80">
                {myPen}–{oppPen} pens
              </div>
            )}
            {live && <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-green-400">Live</div>}
          </>
        ) : (
          <div className="text-[11px] font-bold uppercase tracking-wide text-white/40">Upcoming</div>
        )}
      </div>
    </div>
  );
}

export function TeamHistoryModal({
  teamId,
  matches,
  loading,
  onClose,
}: {
  teamId: string;
  matches: MatchDTO[];
  loading: boolean;
  onClose: () => void;
}) {
  const team = getTeam(teamId);

  // Close on Escape, and support the phone back button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!team) return null;

  const mine = matches
    .filter((m) => m.homeId === teamId || m.awayId === teamId)
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  const played = mine.filter((m) => m.status === "FINISHED");
  const wins = played.filter((m) => m.winnerId === teamId).length;
  const draws = played.filter((m) => !m.winnerId).length;
  const losses = played.length - wins - draws;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: "#0d2137", border: "1px solid rgba(255,255,255,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 px-5 py-4" style={{ background: "linear-gradient(135deg, #1d4270 0%, #163358 100%)" }}>
          <FlagIcon cc={team.cc} name={team.name} className="h-8 w-12 rounded shadow" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-black leading-tight text-white">{team.name}</div>
            <div className="text-xs font-bold text-green-400">
              {played.length > 0 ? `${wins}W · ${draws}D · ${losses}L` : `Group ${team.group}`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-white/50 transition-colors hover:text-white cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-white/35">Tournament results</div>
          {loading && mine.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/40">Loading matches…</div>
          ) : mine.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/40">No matches found.</div>
          ) : (
            mine.map((m) => <HistoryRow key={m.id} teamId={teamId} m={m} />)
          )}
        </div>
      </div>
    </div>
  );
}
