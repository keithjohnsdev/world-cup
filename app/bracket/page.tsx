"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { GROUPS, getTeam, type Team } from "@/lib/data";
import { BRACKET_PAIRS } from "@/lib/bracket";
import { COUNTRY_INFO } from "@/lib/countries";
import { TEAM_STATS } from "@/lib/team-stats";
import { FlagIcon } from "@/components/FlagIcon";
import { NavHeader } from "@/components/ui/NavHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GroupPicksModal } from "@/components/GroupPicksModal";

const GlobeView = dynamic(() => import("@/components/GlobeView"), { ssr: false });
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Picks = Record<string, string>; // key: "stage:slot" → teamId


// Returns the visual rank an item will occupy given the current drag state,
// so rank labels and colors update live as you drag.
function getVisualIndex(arrayIndex: number, dragIdx: number, insertIdx: number): number {
  if (arrayIndex === dragIdx) return insertIdx;
  if (dragIdx > insertIdx && arrayIndex >= insertIdx && arrayIndex < dragIdx) return arrayIndex + 1;
  if (dragIdx < insertIdx && arrayIndex > dragIdx && arrayIndex <= insertIdx) return arrayIndex - 1;
  return arrayIndex;
}

const GROUP_HEADER_STYLE = { bg: "linear-gradient(135deg, #1d4270 0%, #163358 100%)", labelColor: "#86efac", letterColor: "#fbbf24", chipBg: "rgba(255,255,255,0.12)", chipText: "rgba(255,255,255,0.7)" };

function TeamModal({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const team = getTeam(teamId);
  const stats = TEAM_STATS[teamId];
  if (!team || !stats) return null;

  // Split lineup into rows by formation (GK + each formation line)
  const parts = stats.formation.split("-").map(Number);
  const rows: string[][] = [[stats.lineup[0]]];
  let cursor = 1;
  for (const count of parts) {
    rows.push(stats.lineup.slice(cursor, cursor + count));
    cursor += count;
  }

  const oddsDisplay = stats.winOdds < 0.1 ? "<0.1%" : `${stats.winOdds}%`;
  const barWidth = Math.min((stats.winOdds / 20) * 100, 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d2137", border: "1px solid rgba(255,255,255,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ background: "linear-gradient(135deg, #1d4270 0%, #163358 100%)" }}>
          <FlagIcon cc={team.cc} name={team.name} className="w-12 h-8 rounded shadow" />
          <div className="flex-1 min-w-0">
            <div className="text-white font-black text-lg leading-tight truncate">{team.name}</div>
            <div className="text-green-400 text-xs font-bold">Group {team.group}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-yellow-300 font-black text-2xl leading-none">#{stats.fifaRank}</div>
            <div className="text-white/40 text-xs uppercase tracking-wide">FIFA Rank</div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Coach & Formation */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Coach</div>
              <div className="text-white font-bold text-sm">{stats.coach}</div>
            </div>
            <div className="rounded-xl px-4 py-2.5 text-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Formation</div>
              <div className="text-yellow-300 font-black text-sm">{stats.formation}</div>
            </div>
          </div>

          {/* Odds bars */}
          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-xs uppercase tracking-wider mb-1.5">
                <span className="text-white/40">Chance to advance from group</span>
                <span className="text-green-400 font-bold">{stats.groupAdvanceOdds}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${stats.groupAdvanceOdds}%`, background: "linear-gradient(90deg, #166534, #16a34a)" }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs uppercase tracking-wider mb-1.5">
                <span className="text-white/40">Tournament win odds</span>
                <span className="text-yellow-300 font-bold">{oddsDisplay}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${barWidth}%`, background: "linear-gradient(90deg, #16a34a, #fbbf24)" }}
                />
              </div>
            </div>
          </div>

          {/* Lineup */}
          <div>
            <div className="text-white/40 text-xs uppercase tracking-wider mb-2">Estimated Lineup</div>
            <div className="space-y-1.5">
              {rows.map((row, ri) => (
                <div key={ri} className="flex gap-1.5 justify-center flex-wrap">
                  {row.map((player, pi) => (
                    <span
                      key={pi}
                      className="text-xs font-medium whitespace-nowrap rounded-lg px-2 py-1"
                      style={{ background: "rgba(255,255,255,0.07)", color: ri === 0 ? "#fbbf24" : "rgba(255,255,255,0.8)" }}
                    >
                      {player}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Close */}
        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl py-2.5 text-sm font-black uppercase tracking-wide transition-colors cursor-pointer"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DraggableGroupCard({
  group,
  picks,
  onPick,
  onInfoClick,
}: {
  group: (typeof GROUPS)[0];
  picks: Picks;
  onPick: (stage: string, slot: string, teamId: string) => void;
  onInfoClick: (teamId: string) => void;
}) {
  const [order, setOrder] = useState<Team[]>([...group.teams]);
  const hasInitialized = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const dragStartY = useRef(0);
  const itemHeightRef = useRef(52);

  useEffect(() => {
    if (hasInitialized.current) return;
    const ids = [
      picks[`group:${group.id}`],
      picks[`runner:${group.id}`],
      picks[`third:${group.id}`],
      picks[`fourth:${group.id}`],
    ];
    if (!ids.some(Boolean)) return;
    hasInitialized.current = true;
    const ranked = ids
      .map((id) => id ? group.teams.find((t) => t.id === id) : undefined)
      .filter(Boolean) as Team[];
    const rankedIds = new Set(ranked.map((t) => t.id));
    const rest = group.teams.filter((t) => !rankedIds.has(t.id));
    setOrder([...ranked, ...rest]);
  }, [picks, group]);

  function handlePointerDown(e: React.PointerEvent, index: number) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    if (containerRef.current) {
      const kids = containerRef.current.children;
      if (kids.length >= 2) {
        itemHeightRef.current =
          kids[1].getBoundingClientRect().top - kids[0].getBoundingClientRect().top;
      }
    }
    setDragging(index);
    setDragOffset(0);
    setInsertAt(index);
  }

  function handlePointerMove(e: React.PointerEvent, index: number) {
    if (dragging === null || dragging !== index) return;
    const offset = e.clientY - dragStartY.current;
    setDragOffset(offset);
    const raw = Math.round(dragging + offset / itemHeightRef.current);
    setInsertAt(Math.max(0, Math.min(order.length - 1, raw)));
  }

  function handlePointerUp() {
    if (dragging !== null && insertAt !== null && dragging !== insertAt) {
      const newOrder = [...order];
      const [moved] = newOrder.splice(dragging, 1);
      newOrder.splice(insertAt, 0, moved);
      setOrder(newOrder);
      onPick("group",  group.id, newOrder[0].id);
      onPick("runner", group.id, newOrder[1].id);
      onPick("third",  group.id, newOrder[2].id);
      onPick("fourth", group.id, newOrder[3].id);
    }
    setDragging(null);
    setDragOffset(0);
    setInsertAt(null);
  }

  function getTranslateY(index: number): number {
    if (dragging === null || insertAt === null) return 0;
    if (index === dragging) return dragOffset;
    const h = itemHeightRef.current;
    if (dragging > insertAt && index >= insertAt && index < dragging) return h;
    if (dragging < insertAt && index > dragging && index <= insertAt) return -h;
    return 0;
  }

  const rankLabel = ["1st", "2nd", "3rd", "4th"];
  const rankColors = [
    "border-green-500 bg-green-50 text-green-700",
    "border-blue-400 bg-blue-50 text-blue-600",
    "border-gray-300 bg-white text-gray-500",
    "border-gray-300 bg-white text-gray-500",
  ];

  const top1 = picks[`group:${group.id}`] ? getTeam(picks[`group:${group.id}`]) : null;
  const top2 = picks[`runner:${group.id}`] ? getTeam(picks[`runner:${group.id}`]) : null;

  const hs = GROUP_HEADER_STYLE;

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: "1px solid rgba(255,255,255,0.13)" }}>
      {/* Card header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: hs.bg }}>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: hs.labelColor }}>Group</span>
          <span className="font-black text-3xl leading-none" style={{ color: hs.letterColor }}>{group.id}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[top1, top2].map((t, i) =>
            t ? (
              <div key={i} className="flex items-center gap-1 rounded-lg px-1.5 py-0.5" style={{ background: hs.chipBg }}>
                <FlagIcon cc={t.cc} name={t.name} className="w-5 h-3.5" />
                <span className="text-xs font-bold" style={{ color: hs.chipText }}>{i === 0 ? "1st" : "2nd"}</span>
              </div>
            ) : (
              <div key={i} className="w-14 h-6 rounded-lg" style={{ background: hs.chipBg }} />
            )
          )}
        </div>
      </div>

      {/* Teams */}
      <div className="p-3" style={{ background: "#eceae7" }}>
        <div ref={containerRef} className="space-y-1.5" style={{ touchAction: "none" }}>
          {order.flatMap((team, index) => {
            const isDragging = dragging === index;
            const translateY = getTranslateY(index);
            const visualIndex =
              dragging !== null && insertAt !== null
                ? getVisualIndex(index, dragging, insertAt)
                : index;
            const item = (
              <div
                key={team.id}
                onPointerDown={(e) => handlePointerDown(e, index)}
                onPointerMove={(e) => handlePointerMove(e, index)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  transform: `translateY(${translateY}px)`,
                  transition: isDragging ? "box-shadow 150ms ease" : dragging !== null ? "transform 200ms ease" : "box-shadow 150ms ease",
                  zIndex: isDragging ? 10 : 1,
                  position: "relative",
                  boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.13)" : undefined,
                }}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 select-none
                  ${isDragging ? "cursor-grabbing" : "cursor-grab"}
                  ${rankColors[visualIndex]}
                `}
              >
                <span className="text-gray-300 text-base leading-none">⠿</span>
                <FlagIcon cc={team.cc} name={team.name} className="w-7 h-5" />
                <span className="text-sm font-medium truncate">{team.name}</span>
                <span className={`ml-auto text-xs font-bold tabular-nums ${visualIndex < 2 ? "" : "opacity-40"}`}>
                  {rankLabel[visualIndex]}
                </span>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onInfoClick(team.id); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer text-sm leading-none pl-1.5 shrink-0"
                  title="Team info"
                >
                  ℹ
                </button>
              </div>
            );

            return [item];
          })}
        </div>
      </div>
    </div>
  );
}

function SlotBox({
  label,
  teamId,
  onClick,
  highlight,
}: {
  label: string;
  teamId?: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const team = teamId ? getTeam(teamId) : undefined;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col items-center justify-center rounded-xl border-2 transition-all w-24 h-16 text-center
        ${highlight ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"}
        ${onClick ? "hover:border-green-400 cursor-pointer" : "cursor-default"}
      `}
    >
      {team ? (
        <>
          <FlagIcon cc={team.cc} name={team.name} className="w-8 h-6" />
          <span className="text-xs font-medium text-gray-700 truncate w-full px-1">{team.name}</span>
        </>
      ) : (
        <span className="text-xs text-gray-400 px-1">{label}</span>
      )}
    </button>
  );
}

function KnockoutRound({
  title,
  matches,
  picks,
  onPick,
  stage,
}: {
  title: string;
  matches: { slot: string; team1?: string; team2?: string }[];
  picks: Picks;
  onPick: (stage: string, slot: string, teamId: string) => void;
  stage: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="font-bold text-white text-center text-sm">{title}</h3>
      {matches.map((match) => {
        const winner = picks[`${stage}:${match.slot}`];
        const t1 = match.team1 ? getTeam(match.team1) : undefined;
        const t2 = match.team2 ? getTeam(match.team2) : undefined;
        const canPick = !!(t1 && t2);
        return (
          <div key={match.slot} className="flex flex-col items-center gap-1">
            <SlotBox
              label={t1 ? t1.name : "TBD"}
              teamId={match.team1}
              highlight={winner === match.team1}
              onClick={canPick ? () => onPick(stage, match.slot, match.team1!) : undefined}
            />
            <span className="text-white text-xs font-bold">vs</span>
            <SlotBox
              label={t2 ? t2.name : "TBD"}
              teamId={match.team2}
              highlight={winner === match.team2}
              onClick={canPick ? () => onPick(stage, match.slot, match.team2!) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}

// Build bracket matchups from picks
// 2026 format: 32 teams advance (top 2 from each of 12 groups + 8 best 3rd place)
// For simplicity we show R16 using group winners/runners in fixed slots
function buildR32Matches(picks: Picks) {
  return BRACKET_PAIRS.map(([g1, g2], i) => ({
    slot: `m${i + 1}`,
    team1: picks[`group:${g1}`] || undefined,
    team2: picks[`runner:${g2}`] || undefined,
  }));
}

function buildR16Matches(r32picks: Picks, r32matches: ReturnType<typeof buildR32Matches>, picks: Picks) {
  const r16: { slot: string; team1?: string; team2?: string }[] = [];
  for (let i = 0; i < 16; i += 2) {
    const m1 = r32matches[i];
    const m2 = r32matches[i + 1];
    r16.push({
      slot: `m${Math.floor(i / 2) + 1}`,
      team1: r32picks[`r32:${m1.slot}`],
      team2: r32picks[`r32:${m2.slot}`],
    });
  }
  return r16;
}

function buildQFMatches(r16matches: { slot: string; team1?: string; team2?: string }[], picks: Picks) {
  const qf: { slot: string; team1?: string; team2?: string }[] = [];
  for (let i = 0; i < 8; i += 2) {
    qf.push({
      slot: `m${Math.floor(i / 2) + 1}`,
      team1: picks[`r16:${r16matches[i]?.slot}`],
      team2: picks[`r16:${r16matches[i + 1]?.slot}`],
    });
  }
  return qf;
}

function buildSFMatches(qfmatches: { slot: string }[], picks: Picks) {
  return [
    { slot: "m1", team1: picks[`qf:${qfmatches[0]?.slot}`], team2: picks[`qf:${qfmatches[1]?.slot}`] },
    { slot: "m2", team1: picks[`qf:${qfmatches[2]?.slot}`], team2: picks[`qf:${qfmatches[3]?.slot}`] },
  ];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-black uppercase text-white leading-none" style={{ letterSpacing: "-0.01em" }}>{title}</h2>
        <div className="mt-3 h-px bg-gradient-to-r from-yellow-300 via-green-600 to-transparent" />
      </div>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="text-sm font-black uppercase tracking-[0.2em] text-green-400 mb-3">{title}</div>
      {children}
    </div>
  );
}

function ScoreRow({ label, pts }: { label: string; pts: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-green-800 last:border-0">
      <span className="text-green-100 text-base">{label}</span>
      <span className="font-black text-yellow-300 tabular-nums ml-4 shrink-0 text-base">{pts}</span>
    </div>
  );
}

function AwardRow({ name, description, isNew, highlightName }: { name: string; description: string; isNew?: boolean; highlightName?: boolean }) {
  return (
    <div className="py-3 border-b border-green-800 last:border-0">
      <div className={`font-bold text-base ${isNew || highlightName ? "text-yellow-300" : "text-white"}`}>{name}</div>
      <div className={`text-base mt-0.5 ${isNew ? "text-yellow-500/80" : "text-green-400"}`}>{description}</div>
    </div>
  );
}

function PowerRow({ name, description }: { name: string; description: string }) {
  const spaceIdx = name.indexOf(" ");
  const emoji = spaceIdx > 0 ? name.slice(0, spaceIdx) : "";
  const label = spaceIdx > 0 ? name.slice(spaceIdx + 1) : name;
  return (
    <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 px-5 py-4">
      <div className="flex items-center gap-2 mb-1">
        {emoji && <span className="text-2xl leading-none">{emoji}</span>}
        <span className="text-sm font-black uppercase tracking-[0.15em] text-yellow-300">{label}</span>
      </div>
      <div className="text-base text-green-100 leading-relaxed">{description}</div>
    </div>
  );
}

function RulesTab() {
  const [zoom, setZoom] = useState<1 | 1.25 | 1.5>(1);
  return (
    <div className="bg-green-950 min-h-screen">
      {/* Font size picker — hidden for now */}
      <div className="hidden fixed top-16 right-3 z-50 flex items-center gap-1">
        {([1, 1.25, 1.5] as const).map((z, i) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`rounded-lg px-2.5 py-1.5 font-black leading-none transition-colors border
              ${zoom === z ? "bg-yellow-300 text-green-950 border-yellow-300" : "bg-green-900 text-green-400 border-green-700 hover:border-green-400 hover:text-green-200"}`}
            style={{ fontSize: `${0.75 + i * 0.15}rem` }}
            title={["Normal", "Large", "Extra large"][i]}
          >
            A
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-2 pb-20">
      <div style={{ zoom }}>

        <div className="relative rounded-2xl overflow-hidden mb-10 bg-green-950 text-white">
          <div className="px-8 pt-10 pb-11 text-center">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/1/17/2026_FIFA_World_Cup_emblem.svg"
              alt="2026 FIFA World Cup"
              className="w-28 h-auto mx-auto mb-8"
            />

            {/* headline */}
            <h2 className="font-black uppercase leading-none mb-8" style={{ fontSize: "clamp(2.5rem, 8vw, 3.5rem)", letterSpacing: "-0.02em" }}>
              Every four years,<br />
              <span className="text-yellow-300">the world stops.</span>
            </h2>

            {/* body */}
            <div className="space-y-3 mb-9">
              <p className="text-lg font-black italic tracking-tight text-green-100 leading-snug">Forty-eight nations. Six continents. One trophy.</p>
              <p className="text-lg font-black italic tracking-tight text-green-100 leading-snug">Underdogs do the impossible. Giants crumble. Heroes etch their names in eternity…</p>
              <p className="text-2xl font-black italic tracking-tight text-yellow-300 leading-snug mt-6">And the Johnsies will name a new champion.</p>
            </div>

            {/* call to action */}
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-green-700" />
              <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-300">
                Study the flags.<br />
                Trust your gut.<br />
                Make your picks.
              </p>
              <div className="h-px flex-1 bg-green-700" />
            </div>
          </div>
        </div>

        <Section title="How It Works">
          <div className="space-y-4">
            <div className="rounded-xl border border-green-800 bg-green-900/40 p-5">
              <div className="text-sm font-black uppercase tracking-[0.15em] text-yellow-300 mb-2">Phase 1</div>
              <div className="font-bold text-white text-lg mb-1">Group Stage Picks</div>
              <div className="text-sm font-semibold uppercase tracking-wide text-green-500 mb-3">Deadline: before the first match</div>
              <p className="text-base text-green-100 leading-relaxed">For each of the 12 groups, rank all four teams in finishing order (1st–4th). Also name your champion. Picks lock when the tournament begins.</p>
            </div>
            <div className="rounded-xl border border-green-800 bg-green-900/40 p-5">
              <div className="text-sm font-black uppercase tracking-[0.15em] text-yellow-300 mb-2">Phase 2</div>
              <div className="font-bold text-white text-lg mb-1">Knockout Bracket Picks</div>
              <div className="text-sm font-semibold uppercase tracking-wide text-green-500 mb-3">Deadline: before the Round of 32</div>
              <p className="text-base text-green-100 leading-relaxed">Once the group stage is over, the real bracket is set. Everyone picks the knockout rounds fresh — Round of 32 through the Final — using the teams that actually qualified.</p>
            </div>
          </div>
        </Section>

        <Section title="Scoring">
          <Sub title="Group Stage">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <ScoreRow label="1st or 2nd pick — team advances (any top-2 finish)" pts="2 pts" />
              <ScoreRow label="Any pick — team finishes in the exact position you picked (1st–4th)" pts="1 pt" />
              <ScoreRow label="Max per group" pts="8 pts" />
              <ScoreRow label="Max group stage total (12 groups)" pts="96 pts" />
            </div>
          </Sub>
          <Sub title="Knockout Rounds">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <ScoreRow label="Round of 32" pts="2 pts" />
              <ScoreRow label="Round of 16" pts="4 pts" />
              <ScoreRow label="Quarterfinals" pts="8 pts" />
              <ScoreRow label="Semifinals" pts="16 pts" />
              <ScoreRow label="Final" pts="32 pts" />
              <ScoreRow label="Max bracket stage total" pts="160 pts" />
            </div>
            <p className="text-sm text-green-500 mt-2 px-1">Each round has the same total points available (32 pts). No round matters more than any other, they just feel like they do.</p>
          </Sub>
          <Sub title="Champion Bonus">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <ScoreRow label="Your champion pick wins the tournament" pts="+10 pts" />
            </div>
            <p className="text-sm text-green-500 mt-2 px-1">Named during Phase 1. The real reward is built into the bracket, this is just a little extra for calling it before a ball was kicked.</p>
          </Sub>
          <Sub title="Shootout Mercy Rule">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <ScoreRow label="Your pick loses in a penalty shootout" pts="½ pts" />
            </div>
            <p className="text-sm text-green-500 mt-2 px-1">Getting eliminated in the cruelest way possible shouldn&apos;t also cost you full points.</p>
          </Sub>
        </Section>

        <Section title="Kid Powers">
          <p className="text-base text-green-400 mb-4">Players age 10 and under get special powers. Each can only be used once.<br />Be careful, they're very powerful. Tell a grown-up before you use one.</p>
          <div className="space-y-3">
            <PowerRow name="🏆 Champion Charge-Up" description="Your champion bonus is worth +20 pts instead of +10 if they win it all." />
            <PowerRow name="🚃 Kaboose Boost" description="Starting a round in last place? You get 3 free bonus points. Automatic. Can happen more than once." />
            <PowerRow name="❤️ Heart Pick" description="Name your favorite team before the tournament. Every time they win any game — even ones you didn't pick — you earn 1 bonus point." />
            <PowerRow name="⭐ Star Power" description="During Phase 2 (bracket stage only), pick one game and declare it your Star Pick before it starts. Get it right and earn double points. Cannot be used on the Final. One star. Use it well." />
            <PowerRow name="🤝 With Our Powers Combined" description="At any point during the bracket stage, if two kids' scores added together is less than the current leader, they can add their scores together and play the rest of the game as a team." />
          </div>
        </Section>

        <Section title="Awards">
          <p className="text-base text-green-400 mb-4">Everyone wins something. Awards are announced after the Final.</p>
          <Sub title="Glory">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <AwardRow name="The Champion" description="Most total points overall" />
              <AwardRow name="True Believer" description="Named the actual World Cup winner as their champion pick before the tournament" />
              <AwardRow name="The Closer" description="Most points scored in the quarterfinals and beyond — peaked at the right time" />
              <AwardRow name="The Hipster" description="Named the lowest-ranked team to make the deepest run" />
              <AwardRow name="Bracket Brainiac" description="Highest accuracy percentage in the knockout rounds" />
              <AwardRow name="The Pacemaker" description="Led the overall standings for more rounds than anyone else — front-runner all tournament" />
              <AwardRow name="The Hand of God" description="Correctly predicted the winner of every group (1st place, all 12) — near impossible" />
            </div>
          </Sub>
          <Sub title="Funny &amp; Consolation">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <AwardRow name="Wooden Spoon" description="Dead last — awarded with full ceremony and a literal wooden spoon" highlightName />
              <AwardRow name="Heartbreak Hotel" description="Most picks that lost specifically in penalty shootouts — the universe has a grudge" />
              <AwardRow name="The Human Coin Flip" description="Accuracy closest to exactly 50% — perfectly, uselessly neutral" />
              <AwardRow name="Help, I've Gone Cross-Eyed" description="Most picks where the team advanced but in the wrong position" />
              <AwardRow name="The Trendsetter" description="Made the most unique picks that nobody else made — a true contrarian" />
              <AwardRow name="Reverse Oracle" description="Most incorrect picks overall — so reliably wrong you're almost useful" />
              <AwardRow name="Early Retirement" description="Your pre-tournament champion pick was eliminated in the group stage — sent home before the party started" />
            </div>
          </Sub>
          <Sub title="Special">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <AwardRow name="Upset Artist" description="Most correctly predicted upsets — lower-ranked team beats higher-ranked" />
              <AwardRow name="Comeback Kid" description="Biggest point swing — most improved from the bottom half of the standings to the top" />
              <AwardRow name="Close But No Cigar" description="Your champion pick made the Final but lost — you saw it coming, you were almost right, and it hurts" />
            </div>
          </Sub>
        </Section>

        <Section title="General Rules">
          <div className="rounded-xl border border-green-800 bg-green-900/40 px-4 divide-y divide-green-800 text-base text-green-100">
            <div className="py-3">All picks must be submitted before the relevant deadline or they will not count.</div>
            <div className="py-3">Picks are final once locked, except where a Kid Power specifically allows otherwise.</div>
            <div className="py-3">In case of a tie, the co-champions may agree to share the title — or settle it the fun way: all the kids secretly hold up some fingers behind their backs. Each tied player guesses even or odd. Kids reveal. Whoever guesses right wins.</div>
            <div className="py-3">Awards are announced together after the Final.</div>
            <div className="py-3 font-bold text-yellow-300">The Wooden Spoon is non-negotiable and must be accepted with grace.</div>
          </div>
        </Section>

      </div>
      </div>
    </div>
  );
}



function LeaderboardTab() {
  const [entries, setEntries] = useState<{ id: number; name: string; is_kid: boolean; group_score: number; bracket_score: number; total_score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    fetch("/api/leaderboard", { headers: { "x-session-token": token } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEntries(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}>
      <div className="px-4 pt-10 pb-16 max-w-2xl mx-auto">
        <div className="mb-10 text-center">
          <p className="font-black uppercase leading-none text-white mb-1" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>The</p>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-300/60" />
            <h2 className="font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>Leaderboard</h2>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-300/60" />
          </div>
          <p className="text-white/75 text-sm mt-3">Scores update once the tournament begins.</p>
        </div>

        {loading ? (
          <div className="text-center text-white/30 text-sm py-16">Loading…</div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-white/10">
            <div className="grid items-center px-4 py-3 bg-white/5 border-b border-white/10 grid-cols-[1.5rem_1fr_4rem_4.5rem_4rem] sm:grid-cols-[2rem_1fr_6.5rem_7rem_6rem]">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/30 text-center">#</div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Player</div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/30 text-right">Groups</div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/30 text-right">Bracket</div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300/50 text-right">Total</div>
            </div>
            {entries.map((entry, i) => (
              <button
                key={entry.id}
                onClick={() => setSelected({ id: entry.id, name: entry.name })}
                className={`w-full grid items-center px-4 py-4 border-b border-white/5 last:border-0 text-left cursor-pointer transition-colors hover:bg-white/[0.06] active:bg-white/10 grid-cols-[1.5rem_1fr_4rem_4.5rem_4rem] sm:grid-cols-[2rem_1fr_6.5rem_7rem_6rem] ${i === 0 ? "bg-yellow-300/5 hover:bg-yellow-300/10" : ""}`}
              >
                <div className={`text-sm font-black text-center tabular-nums ${i === 0 ? "text-yellow-300" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-white/20"}`}>{i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : i === entries.length - 1 ? <img src="/ladle.png" alt="Wooden Spoon" className="w-5 h-5 object-contain mx-auto" /> : i + 1}</div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white font-bold text-sm truncate">{entry.name}</span>
                  {entry.is_kid && <span className="text-sm shrink-0">⚡</span>}
                </div>
                <div className="text-white/40 text-sm tabular-nums text-right">{entry.group_score}</div>
                <div className="text-white/40 text-sm tabular-nums text-right">{entry.bracket_score}</div>
                <div className="text-yellow-300 font-black text-sm tabular-nums text-right">{entry.total_score}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <GroupPicksModal
          userId={selected.id}
          userName={selected.name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function KidPowerSection({ picks, onPick }: { picks: Picks; onPick: (stage: string, slot: string, teamId: string) => void }) {
  const isKid = picks["meta:isKid"] === "true";
  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">
      <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent mb-10" />
      <div className="text-center mb-8">
        <h2 className="font-black uppercase text-white leading-none mb-3" style={{ fontSize: "clamp(2rem, 6vw, 2.8rem)", letterSpacing: "-0.02em" }}>
          Kid Powers
        </h2>
        <div className="inline-flex items-center gap-2 bg-yellow-300/10 border border-yellow-300/20 rounded-full px-4 py-2">
          <span className="text-lg">🚫</span>
          <span className="text-yellow-300 text-xs font-black uppercase tracking-[0.2em]">No grownups allowed</span>
        </div>
      </div>

      {isKid ? (
        <div>
          <div className="text-center mb-10">
            <div className="inline-flex flex-col items-center gap-3 rounded-2xl border border-yellow-300/30 bg-yellow-300/8 px-10 py-8">
              <span className="text-5xl">⚡</span>
              <div className="text-yellow-300 font-black text-xl uppercase tracking-tight">Kid Powers: Unlocked!</div>
              <p className="text-white/60 text-sm max-w-xs">Your special powers are active. Check the rules to see what you can do.</p>
              <button
                onClick={() => onPick("meta", "isKid", "false")}
                className="mt-2 text-white/25 text-xs underline hover:text-white/50 transition-colors cursor-pointer"
              >
                Actually I&apos;m a grownup
              </button>
            </div>
          </div>

          {/* Heart Pick */}
          <div className="text-center mb-5">
            <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent mb-10" />
            <p className="font-black uppercase leading-none text-white mb-1" style={{ fontSize: "clamp(1rem, 3vw, 1.25rem)", letterSpacing: "-0.01em" }}>Choose your</p>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-10 bg-gradient-to-r from-transparent to-red-400/60" />
              <h2 className="font-black uppercase leading-none text-red-400" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>
                Heart Team
              </h2>
              <div className="h-px w-10 bg-gradient-to-l from-transparent to-red-400/60" />
            </div>
            <div className="text-3xl mt-1">❤️</div>
            <p className="text-white/75 text-sm mt-3">Your favourite team — every game they win earns you +1 bonus point, even ones you didn&apos;t pick.</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {GROUPS.flatMap((g) => g.teams).map((team) => {
              const isSelected = picks["heart:pick"] === team.id;
              return (
                <button
                  key={team.id}
                  onClick={() => onPick("heart", "pick", team.id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 border-2 transition-all cursor-pointer
                    ${isSelected ? "border-red-400 bg-red-400/10" : "border-white/10 bg-white/5 hover:border-white/30"}`}
                >
                  <div className="flex items-center gap-1">
                    {isSelected && <span className="text-xl leading-none">❤️</span>}
                    <FlagIcon cc={team.cc} name={team.name} className="w-10 h-7 rounded-sm" />
                    {isSelected && <span className="text-xl leading-none">❤️</span>}
                  </div>
                  <span className={`text-xs font-bold text-center leading-tight truncate w-full ${isSelected ? "text-red-400" : "text-white/50"}`}>
                    {team.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-white font-black text-2xl mb-8">Are you a kid?</p>
          <button
            onClick={() => onPick("meta", "isKid", "true")}
            className="inline-flex items-center gap-3 bg-yellow-300 hover:bg-yellow-200 text-green-950 font-black text-xl uppercase tracking-tight rounded-2xl px-10 py-5 transition-all cursor-pointer shadow-lg hover:shadow-yellow-300/20 hover:scale-105 active:scale-95"
          >
            <span className="text-3xl">⚡</span>
            Yes, Power Me Up!
          </button>
        </div>
      )}
    </div>
  );
}

function ChampionPicker({ picks, onPick }: { picks: Picks; onPick: (stage: string, slot: string, teamId: string) => void }) {
  const selected = picks["champion:pick"];
  const allTeams = GROUPS.flatMap((g) => g.teams);
  return (
    <div className="max-w-5xl mx-auto px-4 pb-10">
      <div className="mt-10 mb-5 text-center">
        <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent mb-10" />
        <p className="font-black uppercase leading-none text-white mb-1" style={{ fontSize: "clamp(1rem, 3vw, 1.25rem)", letterSpacing: "-0.01em" }}>Choose your</p>
        <div className="flex items-center justify-center gap-3">
          <div className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-300/60" />
          <h2 className="font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>
            Champion
          </h2>
          <div className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-300/60" />
        </div>
        <p className="text-white/75 text-sm mt-3">A correctly chosen champion is worth <span className="text-yellow-300 font-bold">+10</span> bonus points, <span className="text-green-400 font-bold">+20</span> for kids.</p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {allTeams.map((team) => {
          const isSelected = selected === team.id;
          return (
            <button
              key={team.id}
              onClick={() => onPick("champion", "pick", team.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 border-2 transition-all cursor-pointer
                ${isSelected ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-white/5 hover:border-white/30"}`}
            >
              <div className="flex items-center gap-1">
                {isSelected && <span className="text-xl leading-none">🏆</span>}
                <FlagIcon cc={team.cc} name={team.name} className="w-10 h-7 rounded-sm" />
                {isSelected && <span className="text-xl leading-none">🏆</span>}
              </div>
              <span className={`text-xs font-bold text-center leading-tight truncate w-full ${isSelected ? "text-yellow-300" : "text-white/50"}`}>
                {team.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BracketPage() {
  const [picks, setPicks] = useState<Picks>({});
  const [tab, setTab] = useState<"groups" | "bracket" | "rules" | "world" | "leaderboard">("rules");
  const [userName, setUserName] = useState("");
  const [worldView, setWorldView] = useState<"globe" | "map">("globe");
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [modalTeamId, setModalTeamId] = useState<string | null>(null);
  const router = useRouter();

  const picksRef = useRef<Picks>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    const name = localStorage.getItem("wc_name");
    if (!token) { router.replace("/"); return; }
    setUserName(name || "");

    const urlTab = new URLSearchParams(window.location.search).get("tab") as "rules" | "groups" | "bracket" | "world" | "leaderboard" | null;
    if (urlTab && ["rules", "groups", "bracket", "world", "leaderboard"].includes(urlTab)) setTab(urlTab);

    fetch("/api/picks", { headers: { "x-session-token": token } })
      .then((r) => r.json())
      .then((data: { stage: string; slot: string; team_id: string }[]) => {
        if (Array.isArray(data)) {
          const loaded: Picks = {};
          data.forEach(({ stage, slot, team_id }) => { loaded[`${stage}:${slot}`] = team_id; });
          setPicks(loaded);
        }
      });
  }, [router]);

  function handlePick(stage: string, slot: string, teamId: string) {
    setPicks((prev) => {
      const key = `${stage}:${slot}`;
      let next: Picks;
      if (!teamId) {
        next = { ...prev };
        delete next[key];
      } else {
        next = { ...prev, [key]: teamId };
      }
      picksRef.current = next;
      return next;
    });

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const token = localStorage.getItem("wc_token");
      if (!token) return;
      const snap = picksRef.current;
      Promise.all(
        Object.entries(snap).map(([key, tId]) => {
          const [s, sl] = key.split(":");
          return fetch("/api/picks", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-session-token": token },
            body: JSON.stringify({ stage: s, slot: sl, teamId: tId }),
          });
        })
      );
    }, 800);
  }

  const r32matches = buildR32Matches(picks);
  const r16matches = buildR16Matches(picks, r32matches, picks);
  const qfmatches = buildQFMatches(r16matches, picks);
  const sfmatches = buildSFMatches(qfmatches, picks);
  const finalMatch = {
    slot: "m1",
    team1: picks[`sf:${sfmatches[0]?.slot}`],
    team2: picks[`sf:${sfmatches[1]?.slot}`],
  };
  const champion = picks["champion:pick"];
  const championTeam = champion ? getTeam(champion) : undefined;
  const finalWinner = picks["final:m1"];

  const groupPickCount = GROUPS.filter((g) => picks[`group:${g.id}`]).length;

  const handleGlobeHover = useCallback((teamId: string | null) => setHoveredTeam(teamId), []);
  const handleGlobeClick = useCallback((teamId: string) => router.push(`/learn/${teamId}`), [router]);

  function signOut() {
    localStorage.removeItem("wc_token");
    localStorage.removeItem("wc_name");
    router.replace("/");
  }

  return (
    <div className={tab === "world" && worldView === "globe" ? "h-screen flex flex-col overflow-hidden bg-surface-deep" : tab === "world" ? "min-h-screen flex flex-col bg-surface-deep" : "min-h-screen bg-green-950"}>
      <NavHeader
        className="border-b border-white/10"
        style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 50%, #0a1a0f 100%)" }}
        left={
          <div className="flex items-center gap-2 select-none">
            <img src="/world_cup_trophy.png" alt="" style={{ height: 36 }} />
            <div>
              <div className="font-black text-white uppercase tracking-tight text-sm leading-tight">Johnsies</div>
              <div className="font-black text-amber-400 uppercase tracking-tight text-sm leading-tight">World Cup</div>
            </div>
          </div>
        }
        center={
          <div className="flex h-full">
            {(["rules", "groups", "bracket", "leaderboard", "world"] as const).map((t) => (
              <button
                key={t}
                onClick={e => { (e.currentTarget as HTMLElement).style.color = ""; (e.currentTarget as HTMLElement).style.textShadow = ""; setTab(t); history.replaceState(null, "", `?tab=${t}`); }}
                className={`relative flex items-center h-full px-4 text-xs font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all cursor-pointer ${
                  tab === t
                    ? "text-yellow-300"
                    : "text-slate-200"
                }`}
                onMouseEnter={e => { if (tab !== t) { const el = e.currentTarget as HTMLElement; el.style.color = "#ffffff"; el.style.textShadow = "0 0 10px rgba(255,255,255,0.5)"; }}}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = ""; el.style.textShadow = ""; }}
              >
                {t === "groups" ? "Phase 1 - Groups" : t === "bracket" ? "Phase 2 - Bracket" : t === "world" ? "🌍 The World" : t === "leaderboard" ? "Leaderboard" : "The Rules"}
                <span className={`absolute bottom-[-1px] inset-x-0 h-[2px] ${tab === t ? "bg-yellow-300" : ""}`} />
              </button>
            ))}
          </div>
        }
        right={
          <>
            {userName && <span className="text-green-400 text-sm font-medium hidden sm:inline">{userName}</span>}
            <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
          </>
        }
      />

      {/* Champion banner — hidden for now */}
      {false && championTeam && tab !== "world" && (
        <div className="py-3 px-4 flex items-center justify-center gap-4" style={{ background: "linear-gradient(90deg, #92400e, #d97706, #fbbf24, #d97706, #92400e)" }}>
          <span className="text-2xl">🏆</span>
          <div className="text-center">
            <div className="text-amber-900 text-xs font-black uppercase tracking-[0.25em] opacity-70">Your Champion</div>
            <div className="flex items-center gap-2 justify-center mt-0.5">
              <FlagIcon cc={championTeam!.cc} name={championTeam!.name} className="w-8 h-6 rounded shadow" />
              <span className="font-black text-amber-900 text-lg leading-tight">{championTeam!.name}</span>
            </div>
          </div>
          <span className="text-2xl">🏆</span>
        </div>
      )}


      {/* Groups tab */}
      {tab === "groups" && (
        <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}>
          <div className="px-4 pt-10 pb-8 max-w-5xl mx-auto">
            <div className="mb-10 text-center">
              <p className="font-black uppercase leading-none text-white mb-1" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>The</p>
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-300/60" />
                <h2 className="font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>
                  Group Stage
                </h2>
                <div className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-300/60" />
              </div>
              <p className="text-white/75 text-sm mt-3">
                Drag teams to rank all four finishing positions — <span className="text-green-400 font-bold">top 2</span> advance, but you still get points for correctly choosing <span className="text-yellow-300 font-bold">3rd</span> and <span className="text-yellow-300 font-bold">4th</span> place!
              </p>
            </div>
            {(() => {
              const filledGroups = GROUPS.filter(g =>
                picks[`group:${g.id}`] && picks[`runner:${g.id}`] && picks[`third:${g.id}`] && picks[`fourth:${g.id}`]
              );
              const missingGroups = GROUPS.filter(g => !filledGroups.includes(g));
              const filled = filledGroups.length;
              const total = GROUPS.length;
              const championPicked = !!picks["champion:pick"];
              const allDone = filled === total && championPicked;
              const missingItems = missingGroups.length === total
                ? [<span key="all"><span className="text-yellow-300 font-black">all groups</span>{!championPicked && ", "}</span>, ...(!championPicked ? [<span key="champion"><span className="text-yellow-300 font-black">Champion</span></span>] : [])]
                : [
                    ...missingGroups.map((g, i) => <span key={g.id}>{i > 0 && ", "}Group <span className="text-yellow-300 font-black">{g.id}</span></span>),
                    ...(!championPicked ? [<span key="champion">{missingGroups.length > 0 && ", "}<span className="text-yellow-300 font-black">Champion</span></span>] : []),
                  ];
              return (
                <div className="mb-8 text-center">
                  <p className={`text-sm font-bold mb-2.5 ${allDone ? "text-green-400" : "text-white"}`}>
                    {allDone
                      ? "✓ All 12 groups complete and champion picked — you're ready for Phase 2!"
                      : <>{filled} of {total} groups filled in <span className="text-white/50 font-medium">(missing {missingItems})</span></>}
                  </p>
                  <div className="h-1.5 rounded-full overflow-hidden max-w-xs mx-auto" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(filled / total) * 100}%`, background: allDone ? "#4ade80" : "#fbbf24" }}
                    />
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-3 sm:px-0">
              {GROUPS.map((group) => (
                <DraggableGroupCard key={group.id} group={group} picks={picks} onPick={handlePick} onInfoClick={setModalTeamId} />
              ))}
            </div>
          </div>
          <ChampionPicker picks={picks} onPick={handlePick} />
          <KidPowerSection picks={picks} onPick={handlePick} />
        </div>
      )}

      {/* Rules tab */}
      {tab === "rules" && <RulesTab />}
      {tab === "leaderboard" && <LeaderboardTab />}

      {/* World tab */}
      {tab === "world" && (
        <div
          className={worldView === "globe" ? "flex-1 relative min-h-0" : "relative"}
          onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
        >
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full bg-black/30 p-1 backdrop-blur-sm">
            {(["globe", "map"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setWorldView(v)}
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-[0.12em] transition-all ${
                  worldView === v ? "bg-yellow-300 text-green-950" : "text-white/60 hover:text-white"
                }`}
              >
                {v === "globe" ? "🌐 Globe" : "🗺 Map"}
              </button>
            ))}
          </div>
          <p className="absolute top-12 left-1/2 -translate-x-1/2 z-10 text-white/40 text-xs pointer-events-none whitespace-nowrap">
            {worldView === "globe"
              ? "Rotate the globe · hover a country · click to explore"
              : "Hover a country · click to explore"}
          </p>
          {worldView === "globe" ? (
            <GlobeView onHover={handleGlobeHover} onCountryClick={handleGlobeClick} />
          ) : (
            <MapView onHover={handleGlobeHover} onCountryClick={handleGlobeClick} />
          )}
          {hoveredTeam && COUNTRY_INFO[hoveredTeam] && (() => {
            const team = getTeam(hoveredTeam);
            const info = COUNTRY_INFO[hoveredTeam];
            const flipX = mousePos.x + 16 + 320 > window.innerWidth;
            const flipY = mousePos.y + 16 + 200 > window.innerHeight;
            const cardStyle = worldView === "map"
              ? { left: flipX ? mousePos.x - 336 : mousePos.x + 16, top: flipY ? mousePos.y - 216 : mousePos.y + 16 }
              : { left: "50%" as const, bottom: "1.5rem", transform: "translateX(-50%)" };
            return team && info ? (
              <div className="fixed z-20 pointer-events-none" style={cardStyle}>
                <Card variant="dark" className="px-5 py-4 min-w-[260px] max-w-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <FlagIcon cc={team.cc} name={team.name} className="w-10 h-7 rounded" />
                    <div>
                      <div className="text-white font-bold text-lg leading-tight">{team.name}</div>
                      <div className="text-brand-400 text-xs font-medium">Group {team.group} · {info.capital}</div>
                    </div>
                  </div>
                  <p className="text-white/70 text-xs leading-relaxed line-clamp-3">
                    {info.soccerHistory.split(".")[0]}.
                  </p>
                  <p className="text-brand-400/70 text-xs mt-2">Click to learn more →</p>
                </Card>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {modalTeamId && <TeamModal teamId={modalTeamId} onClose={() => setModalTeamId(null)} />}

      {/* Bracket tab */}
      {tab === "bracket" && (
        <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}>
          <div className="px-4 pt-10 pb-8 max-w-5xl mx-auto">
            <div className="mb-10 text-center">
              <p className="font-black uppercase leading-none text-white mb-1" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>The</p>
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-300/60" />
                <h2 className="font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>
                  Bracket Stage
                </h2>
                <div className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-300/60" />
              </div>
              <p className="text-white/75 text-sm mt-3">Bracket will be available to pick once the group stage is complete.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
