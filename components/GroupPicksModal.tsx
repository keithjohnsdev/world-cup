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

function scorePosition(pickedId: string | null, posIdx: number, actual: (string | null)[]): number {
  if (!pickedId || !actual.some(Boolean)) return 0;
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

interface Props {
  userId: number;
  userName: string;
  onClose: () => void;
}

export function GroupPicksModal({ userId, userName, onClose }: Props) {
  const [picks, setPicks] = useState<Entry[]>([]);
  const [results, setResults] = useState<Entry[]>([]);
  const [heartPickTeamId, setHeartPickTeamId] = useState<string | null>(null);
  const [heartPoints, setHeartPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/picks/${userId}`)
      .then(r => r.json())
      .then(d => {
        setPicks(d.picks ?? []);
        setResults(d.results ?? []);
        setHeartPickTeamId(d.heartPickTeamId ?? null);
        setHeartPoints(d.heartPoints ?? 0);
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
  const hasResults = results.length > 0;

  const totalPoints = GROUPS.reduce((sum, g) =>
    sum + STAGES.reduce((s, _, i) => s + scorePosition(pickMap[g.id]?.[i] ?? null, i, resultMap[g.id] ?? []), 0), 0);

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

          {hasResults && (
            <div className="text-right shrink-0">
              <div className="flex items-baseline gap-1.5 justify-end">
                <div className="text-yellow-300 font-black text-2xl leading-none">{totalPoints}</div>
                {heartPoints > 0 && (
                  <div className="text-red-400 font-black text-sm leading-none">+{heartPoints} ❤️</div>
                )}
              </div>
              <div className="text-white/40 text-[10px] uppercase tracking-wide">of 96 pts</div>
            </div>
          )}

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
            GROUPS.map(group => {
              const predicted = pickMap[group.id] ?? [];
              const actual = resultMap[group.id] ?? [];
              const groupHasResult = actual.some(Boolean);
              const groupPts = STAGES.reduce((s, _, i) => s + scorePosition(predicted[i] ?? null, i, actual), 0);

              return (
                <div key={group.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.09)" }}>
                  {/* Group header */}
                  <div
                    className="flex items-center justify-between px-4 py-2"
                    style={{ background: "linear-gradient(135deg, #1d4270 0%, #163358 100%)" }}
                  >
                    <span className="text-yellow-300 font-black text-xs uppercase tracking-[0.2em]">Group {group.id}</span>
                    {groupHasResult && (
                      <span className="text-white/50 text-xs font-bold tabular-nums">{groupPts} / 8 pts</span>
                    )}
                  </div>

                  {/* 4 position rows */}
                  {STAGES.map((stage, posIdx) => {
                    const pickedId = predicted[posIdx] ?? null;
                    const team = pickedId ? getTeam(pickedId) : null;
                    const pts = scorePosition(pickedId, posIdx, actual);

                    const actualIdx = pickedId ? actual.indexOf(pickedId) : -1;
                    const actualLabel = actualIdx >= 0 ? POS_LABEL[STAGES[actualIdx]] : null;

                    let rowBg = "";
                    let ptsCls = "text-white/20";
                    if (groupHasResult && pickedId) {
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

                        {team ? (
                          <>
                            <FlagIcon cc={team.cc} name={team.name} className="w-8 h-[22px] rounded shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-white text-sm font-semibold leading-tight truncate">{team.name}</span>
                                {team.id === heartPickTeamId && heartPoints > 0 && (
                                  <span className="text-red-400 text-[11px] font-black shrink-0 whitespace-nowrap">+{heartPoints} ❤️</span>
                                )}
                              </div>
                              {groupHasResult && (
                                <div className="text-white/35 text-[10px] leading-none mt-0.5">
                                  {actualLabel ? `finished ${actualLabel}` : "result pending"}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 text-white/20 text-sm italic">No pick</div>
                        )}

                        {groupHasResult && pickedId && (
                          <div className={`text-sm font-black shrink-0 tabular-nums ${ptsCls}`}>
                            +{pts}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
