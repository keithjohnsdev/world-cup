"use client";

import { useEffect, useState, useCallback } from "react";
import { GROUPS, getTeam } from "@/lib/data";
import { FlagIcon } from "@/components/FlagIcon";

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
  onClose: () => void;
}

export function GroupPicksModal({ userId, userName, breakdown, groupStageComplete, onClose }: Props) {
  const [picks, setPicks] = useState<Entry[]>([]);
  const [results, setResults] = useState<Entry[]>([]);
  const [heartPickTeamId, setHeartPickTeamId] = useState<string | null>(null);
  const [heartPoints, setHeartPoints] = useState(0);
  const [championPickTeamId, setChampionPickTeamId] = useState<string | null>(null);
  const [playedTeamIds, setPlayedTeamIds] = useState<string[]>([]);
  const [groupPoints, setGroupPoints] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/picks/${userId}`)
      .then(r => r.json())
      .then(d => {
        setPicks(d.picks ?? []);
        setResults(d.results ?? []);
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
  const hasResults = results.length > 0;

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
            <div className="text-green-400 text-xs font-bold uppercase tracking-wider mt-0.5">Group Stage Picks</div>
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
            {/* Champion pick */}
            {(() => {
              const championTeam = championPickTeamId ? getTeam(championPickTeamId) : null;
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
                      </div>
                    </div>
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
                            <span className="relative -top-[0.5px]">Perfect group!</span>
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
                      <div className="w-16 shrink-0 text-center text-white/30 text-[9px] font-black uppercase tracking-[0.18em]">
                        {groupStageComplete ? "Final" : "Actual"}
                      </div>
                      <div className="w-8 shrink-0" />
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

                    return (
                      <div
                        key={stage}
                        className="flex items-center gap-3 px-4 py-2.5"
                        style={{ background: rowBg || undefined, borderTop: "1px solid rgba(255,255,255,0.05)" }}
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
                          <div className="w-16 shrink-0 flex items-center justify-center gap-1.5">
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
                                {actualId != null && playedSet.has(actualId) && (
                                  <span className="text-white/55 text-[11px] font-bold tabular-nums leading-none w-4 text-left">
                                    {groupPoints[actualId] ?? 0}
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
