"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { GROUPS, getTeam, type Team } from "@/lib/data";
import { COUNTRY_INFO } from "@/lib/countries";
import { FlagIcon } from "@/components/FlagIcon";
import { NavHeader } from "@/components/ui/NavHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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

function DraggableGroupCard({
  group,
  picks,
  onPick,
}: {
  group: (typeof GROUPS)[0];
  picks: Picks;
  onPick: (stage: string, slot: string, teamId: string) => void;
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
          <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: hs.labelColor }}>Group</span>
          <span className="font-black text-3xl leading-none" style={{ color: hs.letterColor }}>{group.id}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[top1, top2].map((t, i) =>
            t ? (
              <div key={i} className="flex items-center gap-1 rounded-lg px-1.5 py-0.5" style={{ background: hs.chipBg }}>
                <FlagIcon cc={t.cc} name={t.name} className="w-5 h-3.5" />
                <span className="text-[10px] font-bold" style={{ color: hs.chipText }}>{i === 0 ? "1st" : "2nd"}</span>
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
  // Each group produces a winner (1st) and runner-up (2nd)
  // R32 matchup pairs based on FIFA 2026 bracket structure (simplified)
  const bracketPairs: [string, string][] = [
    ["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"],
    ["I", "J"], ["K", "L"], ["A", "C"], ["B", "D"],
    ["E", "G"], ["F", "H"], ["I", "K"], ["J", "L"],
    ["A", "D"], ["B", "C"], ["E", "H"], ["F", "G"],
  ];
  return bracketPairs.map(([g1, g2], i) => ({
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

function AwardRow({ name, description }: { name: string; description: string }) {
  return (
    <div className="py-3 border-b border-green-800 last:border-0">
      <div className="font-bold text-white text-base">{name}</div>
      <div className="text-base text-green-400 mt-0.5">{description}</div>
    </div>
  );
}

function PowerRow({ name, description }: { name: string; description: string }) {
  return (
    <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 px-5 py-4">
      <div className="text-sm font-black uppercase tracking-[0.15em] text-yellow-300 mb-1">{name}</div>
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
              <ScoreRow label="Round of 32" pts="3 pts" />
              <ScoreRow label="Round of 16" pts="6 pts" />
              <ScoreRow label="Quarterfinals" pts="12 pts" />
              <ScoreRow label="Semifinals" pts="24 pts" />
              <ScoreRow label="Final" pts="48 pts" />
            </div>
            <p className="text-sm text-green-500 mt-2 px-1">Each round has the same total points available (48 pts). No round matters more than any other, they just feel like they do.</p>
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

        <Section title="Awards">
          <p className="text-base text-green-400 mb-4">Everyone wins something. Awards are announced after the Final.</p>
          <Sub title="Glory">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <AwardRow name="The Champion" description="Most total points overall" />
              <AwardRow name="True Believer" description="Named the actual World Cup winner as their champion pick before the tournament" />
              <AwardRow name="The Closer" description="Most points scored in the quarterfinals and beyond — peaked at the right time" />
              <AwardRow name="The Hipster" description="Named the lowest-ranked team to make the deepest run" />
              <AwardRow name="Bracket Brainiac" description="Highest accuracy percentage in the knockout rounds" />
              <AwardRow name="Dead Cert" description="Correctly predicted the winner of every group (1st place, all 12) — near impossible" />
            </div>
          </Sub>
          <Sub title="Funny &amp; Consolation">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <AwardRow name="Wooden Spoon" description="Dead last — awarded with full ceremony and a literal wooden spoon" />
              <AwardRow name="Heartbreak Hotel" description="Most picks that lost specifically in penalty shootouts — the universe has a grudge" />
              <AwardRow name="The Human Coin Flip" description="Accuracy closest to exactly 50% — perfectly, uselessly neutral" />
              <AwardRow name="Help, I've Gone Cross-Eyed" description="Most picks where the team advanced but in the wrong position" />
              <AwardRow name="The Trendsetter" description="Made the most unique picks that nobody else made — a true contrarian" />
              <AwardRow name="Reverse Oracle" description="Most incorrect picks overall — so reliably wrong you're almost useful" />
            </div>
          </Sub>
          <Sub title="Skill">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <AwardRow name="Upset Artist" description="Most correctly predicted upsets — lower-ranked team beats higher-ranked" />
            </div>
          </Sub>
          <Sub title="Special">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <AwardRow name="Comeback Kid" description="Biggest point swing — most improved from the bottom half of the standings to the top" />
            </div>
          </Sub>
        </Section>

        <Section title="Kid Powers">
          <p className="text-base text-green-400 mb-4">Players age 10 and under get special powers. Each can only be used once. Tell a grown-up before you use one.</p>
          <div className="space-y-3">
            <PowerRow name="Champion Boost" description="Your champion bonus is worth +20 pts instead of +10 if they win it all." />
            <PowerRow name="Comeback Chip" description="Starting a round in last place? You get 3 free bonus points. Automatic. Can happen more than once." />
            <PowerRow name="Heart Pick" description="Name your favorite team before the tournament. Every time they win any game — even ones you didn't pick — you earn 1 bonus point." />
            <PowerRow name="Star Power" description="Pick one game and declare it your Star Pick before it starts. Get it right and earn double points. One star. Use it well." />
          </div>
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
        <p className="text-white/40 text-sm mt-3">A correctly chosen champion is worth +10 bonus points, +20 for kids.</p>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1.5">
        {allTeams.map((team) => {
          const isSelected = selected === team.id;
          return (
            <button
              key={team.id}
              onClick={() => onPick("champion", "pick", team.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 border-2 transition-all cursor-pointer
                ${isSelected ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-white/5 hover:border-white/30"}`}
            >
              <FlagIcon cc={team.cc} name={team.name} className="w-8 h-6 rounded-sm" />
              <span className={`text-[9px] font-bold text-center leading-tight truncate w-full ${isSelected ? "text-yellow-300" : "text-white/50"}`}>
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
  const [tab, setTab] = useState<"groups" | "bracket" | "rules" | "world">("rules");
  const [userName, setUserName] = useState("");
  const [worldView, setWorldView] = useState<"globe" | "map">("globe");
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const router = useRouter();

  const picksRef = useRef<Picks>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    const name = localStorage.getItem("wc_name");
    if (!token) { router.replace("/"); return; }
    setUserName(name || "");

    const urlTab = new URLSearchParams(window.location.search).get("tab") as "rules" | "groups" | "bracket" | "world" | null;
    if (urlTab && ["rules", "groups", "bracket", "world"].includes(urlTab)) setTab(urlTab);

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
    <div className={tab === "world" ? "h-screen flex flex-col overflow-hidden bg-surface-deep" : "min-h-screen bg-green-950"}>
      <NavHeader
        className="border-b border-white/10"
        style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 50%, #0a1a0f 100%)" }}
        left={
          <div className="select-none">
            <div className="leading-none">
              <span className="font-black text-white uppercase tracking-tight text-sm">Johnsies </span>
              <span className="font-black text-amber-400 uppercase tracking-tight text-sm">World Cup</span>
            </div>
            <div className="text-green-600 text-[8px] font-black uppercase tracking-[0.2em] mt-0.5">
              2026
            </div>
          </div>
        }
        center={
          <div className="flex h-full">
            {(["rules", "groups", "bracket", "world"] as const).map((t) => (
              <button
                key={t}
                onClick={e => { (e.currentTarget as HTMLElement).style.color = ""; (e.currentTarget as HTMLElement).style.textShadow = ""; setTab(t); }}
                className={`relative flex items-center h-full px-4 text-xs font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all cursor-pointer ${
                  tab === t
                    ? "text-yellow-300"
                    : "text-slate-200"
                }`}
                onMouseEnter={e => { if (tab !== t) { const el = e.currentTarget as HTMLElement; el.style.color = "#ffffff"; el.style.textShadow = "0 0 10px rgba(255,255,255,0.5)"; }}}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = ""; el.style.textShadow = ""; }}
              >
                {t === "groups" ? "Phase 1 - Groups" : t === "bracket" ? "Phase 2 - Knockout" : t === "world" ? "🌍 The World" : "The Rules"}
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

      {/* Champion banner */}
      {championTeam && tab !== "world" && (
        <div className="py-3 px-4 flex items-center justify-center gap-4" style={{ background: "linear-gradient(90deg, #92400e, #d97706, #fbbf24, #d97706, #92400e)" }}>
          <span className="text-2xl">🏆</span>
          <div className="text-center">
            <div className="text-amber-900 text-[10px] font-black uppercase tracking-[0.25em] opacity-70">Your Champion</div>
            <div className="flex items-center gap-2 justify-center mt-0.5">
              <FlagIcon cc={championTeam.cc} name={championTeam.name} className="w-8 h-6 rounded shadow" />
              <span className="font-black text-amber-900 text-lg leading-tight">{championTeam.name}</span>
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
              <p className="text-white/50 text-sm mt-3">
                Drag teams to rank all four finishing positions — top 2 advance, but you still get points for correctly choosing 3rd and 4th place!
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {GROUPS.map((group) => (
                <DraggableGroupCard key={group.id} group={group} picks={picks} onPick={handlePick} />
              ))}
            </div>
          </div>
          <ChampionPicker picks={picks} onPick={handlePick} />
        </div>
      )}

      {/* Rules tab */}
      {tab === "rules" && <RulesTab />}

      {/* World tab */}
      {tab === "world" && (
        <div className="flex-1 relative min-h-0">
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
              ? "Rotate the globe · hover a green country · click to explore"
              : "Hover a green country · click to explore"}
          </p>
          {worldView === "globe" ? (
            <GlobeView onHover={handleGlobeHover} onCountryClick={handleGlobeClick} />
          ) : (
            <div className="h-full flex items-center">
              <MapView onHover={handleGlobeHover} onCountryClick={handleGlobeClick} />
            </div>
          )}
          {hoveredTeam && COUNTRY_INFO[hoveredTeam] && (() => {
            const team = getTeam(hoveredTeam);
            const info = COUNTRY_INFO[hoveredTeam];
            return team && info ? (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
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

      {/* Bracket tab */}
      {tab === "bracket" && (
        <div className="min-h-screen flex items-center justify-center bg-green-950">
          <p className="text-white/50 text-sm text-center px-8">Bracket will be available to pick once the group stage is complete.</p>
        </div>
      )}
    </div>
  );
}
