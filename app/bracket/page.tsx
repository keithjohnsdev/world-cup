"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { GROUPS, getTeam, type Team } from "@/lib/data";
import { FlagIcon } from "@/components/FlagIcon";
import { NavHeader } from "@/components/ui/NavHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Picks = Record<string, string>; // key: "stage:slot" → teamId


// Returns the visual rank an item will occupy given the current drag state,
// so rank labels and colors update live as you drag.
function getVisualIndex(arrayIndex: number, dragIdx: number, insertIdx: number): number {
  if (arrayIndex === dragIdx) return insertIdx;
  if (dragIdx > insertIdx && arrayIndex >= insertIdx && arrayIndex < dragIdx) return arrayIndex + 1;
  if (dragIdx < insertIdx && arrayIndex > dragIdx && arrayIndex <= insertIdx) return arrayIndex - 1;
  return arrayIndex;
}

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

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      {/* Card header */}
      <div className="bg-surface-dark px-4 py-3 flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-brand-400 text-[10px] font-bold uppercase tracking-[0.25em]">Group</span>
          <span className="text-white font-black text-3xl leading-none">{group.id}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[top1, top2].map((t, i) =>
            t ? (
              <div key={i} className="flex items-center gap-1 rounded-lg px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.12)" }}>
                <FlagIcon cc={t.cc} name={t.name} className="w-5 h-3.5" />
                <span className="text-white/60 text-[10px] font-bold">{i === 0 ? "1st" : "2nd"}</span>
              </div>
            ) : (
              <div key={i} className="w-14 h-6 rounded-lg" style={{ background: "rgba(255,255,255,0.07)" }} />
            )
          )}
        </div>
      </div>

      {/* Teams */}
      <div className="bg-white p-3">
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
                  transition: isDragging ? "box-shadow 150ms ease" : "transform 200ms ease",
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

            if (index === 1) {
              return [
                item,
                <div key="sep" className="flex items-center gap-2 py-0.5 select-none pointer-events-none" style={{ position: "relative", zIndex: 0 }}>
                  <div className="h-px flex-1 bg-green-200" />
                  <span className="text-[9px] font-black text-green-500 uppercase tracking-[0.2em] whitespace-nowrap">advances</span>
                  <div className="h-px flex-1 bg-green-200" />
                </div>,
              ];
            }
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
        <div className="text-[0.6rem] font-black uppercase tracking-[0.3em] text-green-500 mb-1.5">— Section</div>
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
      <div className="text-xs font-black uppercase tracking-[0.2em] text-green-400 mb-3">{title}</div>
      {children}
    </div>
  );
}

function ScoreRow({ label, pts }: { label: string; pts: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-green-800 last:border-0">
      <span className="text-green-100 text-sm">{label}</span>
      <span className="font-black text-yellow-300 tabular-nums ml-4 shrink-0 text-sm">{pts}</span>
    </div>
  );
}

function AwardRow({ name, description }: { name: string; description: string }) {
  return (
    <div className="py-3 border-b border-green-800 last:border-0">
      <div className="font-bold text-white text-sm">{name}</div>
      <div className="text-sm text-green-400 mt-0.5">{description}</div>
    </div>
  );
}

function PowerRow({ name, description }: { name: string; description: string }) {
  return (
    <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 px-5 py-4">
      <div className="text-xs font-black uppercase tracking-[0.15em] text-yellow-300 mb-1">{name}</div>
      <div className="text-sm text-green-100 leading-relaxed">{description}</div>
    </div>
  );
}

function RulesTab() {
  const [zoom, setZoom] = useState<1 | 1.25 | 1.5>(1);
  return (
    <div className="bg-green-950 min-h-screen">
      {/* Font size picker — fixed top-right, always visible */}
      <div className="fixed top-16 right-3 z-50 flex items-center gap-1">
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

      <div className="max-w-2xl mx-auto px-4 py-8">
      <div style={{ zoom }}>

        <div className="relative rounded-2xl overflow-hidden mb-10 bg-green-950 text-white">
          <div className="px-8 pt-10 pb-11">
            {/* eyebrow */}
            <div className="text-xs font-black uppercase tracking-[0.25em] text-green-400 mb-6">
              World Cup 2026 &mdash; Family Bracket Challenge
            </div>

            {/* headline */}
            <h2 className="font-black uppercase leading-none mb-8" style={{ fontSize: "clamp(2.5rem, 8vw, 3.5rem)", letterSpacing: "-0.02em" }}>
              Every four years,<br />
              <span className="text-yellow-300">the world stops.</span>
            </h2>

            {/* body */}
            <div className="space-y-4 text-base text-green-100 leading-relaxed mb-9">
              <p>
                Forty-eight nations. Six continents. One trophy.
              </p>
              <p>
                Underdogs do the impossible.
                Giants crumble. Heroes etch their names in eternity.
              </p>
              <p>
                And somewhere in all that chaos and beauty, somebody in this family is going to
                get it <em className="text-white not-italic font-semibold">exactly right.</em>
              </p>
            </div>

            {/* call to action */}
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-green-700" />
              <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-300 text-center">
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
              <div className="text-xs font-black uppercase tracking-[0.15em] text-yellow-300 mb-2">Phase 1</div>
              <div className="font-bold text-white mb-1">Group Stage Picks</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-green-500 mb-3">Deadline: before the first match</div>
              <p className="text-sm text-green-100 leading-relaxed">For each of the 12 groups, rank all four teams in finishing order (1st–4th). Also name your champion. Picks lock when the tournament begins.</p>
            </div>
            <div className="rounded-xl border border-green-800 bg-green-900/40 p-5">
              <div className="text-xs font-black uppercase tracking-[0.15em] text-yellow-300 mb-2">Phase 2</div>
              <div className="font-bold text-white mb-1">Knockout Bracket Picks</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-green-500 mb-3">Deadline: before the Round of 32</div>
              <p className="text-sm text-green-100 leading-relaxed">Once the group stage is over, the real bracket is set. Everyone picks the knockout rounds fresh — Round of 32 through the Final — using the teams that actually qualified.</p>
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
            <p className="text-xs text-green-500 mt-2 px-1">Each round has the same total points available (48 pts). No round matters more than any other, they just feel like they do.</p>
          </Sub>
          <Sub title="Champion Bonus">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <ScoreRow label="Your champion pick wins the tournament" pts="+10 pts" />
            </div>
            <p className="text-xs text-green-500 mt-2 px-1">Named during Phase 1. The real reward is built into the bracket, this is just a little extra for calling it before a ball was kicked.</p>
          </Sub>
          <Sub title="Shootout Mercy Rule">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <ScoreRow label="Your pick loses in a penalty shootout" pts="½ pts" />
            </div>
            <p className="text-xs text-green-500 mt-2 px-1">Getting eliminated in the cruelest way possible shouldn&apos;t also cost you full points.</p>
          </Sub>
        </Section>

        <Section title="Awards">
          <p className="text-sm text-green-400 mb-4">Everyone wins something. Awards are announced after the Final.</p>
          <Sub title="Glory">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <AwardRow name="The Champion" description="Most total points overall" />
              <AwardRow name="True Believer" description="Named the actual World Cup winner as their champion pick before the tournament" />
              <AwardRow name="Group Stage Guru" description="Most points in the group stage" />
              <AwardRow name="The Closer" description="Most points scored in the quarterfinals and beyond — peaked at the right time" />
              <AwardRow name="Dark Horse Whisperer" description="Named the lowest-ranked team to make the deepest run" />
              <AwardRow name="Bracket Brainiac" description="Highest accuracy percentage in the knockout rounds" />
              <AwardRow name="Dead Cert" description="Correctly predicted the winner of every group (1st place, all 12) — near impossible" />
            </div>
          </Sub>
          <Sub title="Funny &amp; Consolation">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <AwardRow name="Wooden Spoon" description="Dead last — awarded with full ceremony and a literal wooden spoon" />
              <AwardRow name="Heartbreak Hotel" description="Most picks that lost specifically in penalty shootouts — the universe has a grudge" />
              <AwardRow name="The Human Coin Flip" description="Accuracy closest to exactly 50% — perfectly, uselessly neutral" />
              <AwardRow name="Help, I've Gone Cross-Eyed" description="Most picks where the team advanced but in the wrong position — so close, so often" />
              <AwardRow name="The Trendsetter" description="Made the most unique picks that nobody else made — a true contrarian" />
              <AwardRow name="Reverse Oracle" description="Most incorrect picks overall — so reliably wrong you're almost useful" />
            </div>
          </Sub>
          <Sub title="Skill">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <AwardRow name="Perfect Round" description="Got every single pick correct in one round (any round counts)" />
              <AwardRow name="Upset Artist" description="Most correctly predicted upsets — lower-ranked team beats higher-ranked" />
              <AwardRow name="Crystal Ball" description="Most total correct picks by raw count across the whole tournament" />
            </div>
          </Sub>
          <Sub title="Special">
            <div className="rounded-xl border border-green-800 bg-green-900/40 px-4">
              <AwardRow name="Rookie Star" description="Best score among players age 10 and under — kids compete against each other" />
              <AwardRow name="Comeback Kid" description="Biggest point swing — most improved from the bottom half of the standings to the top" />
              <AwardRow name="The Commentator" description="Most enthusiastic trash-talker on the leaderboard (voted, not scored)" />
              <AwardRow name="The Hipster" description="Whose champion pick was the most obscure team that went the farthest — scored as seed × rounds advanced" />
            </div>
          </Sub>
        </Section>

        <Section title="Kid Powers">
          <p className="text-sm text-green-400 mb-4">Players age 10 and under get special powers. Each can only be used once. Tell a grown-up before you use one.</p>
          <div className="space-y-3">
            <PowerRow name="Champion Boost" description="Your champion bonus is worth +20 pts instead of +10 if they win it all." />
            <PowerRow name="Comeback Chip" description="Starting a round in last place? You get 3 free bonus points. Automatic. Can happen more than once." />
            <PowerRow name="Heart Pick" description="Name your favorite team before the tournament. Every time they win any game — even ones you didn't pick — you earn 1 bonus point." />
            <PowerRow name="Star Power" description="Pick one game and declare it your Star Pick before it starts. Get it right and earn double points. One star. Use it well." />
          </div>
        </Section>

        <Section title="General Rules">
          <div className="rounded-xl border border-green-800 bg-green-900/40 px-4 divide-y divide-green-800 text-sm text-green-100">
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

export default function BracketPage() {
  const [picks, setPicks] = useState<Picks>({});
  const [tab, setTab] = useState<"groups" | "bracket" | "rules">("rules");
  const [userName, setUserName] = useState("");
  const router = useRouter();

  const picksRef = useRef<Picks>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    const name = localStorage.getItem("wc_name");
    if (!token) { router.replace("/"); return; }
    setUserName(name || "");

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
  const champion = picks["final:m1"];
  const championTeam = champion ? getTeam(champion) : undefined;

  const groupPickCount = GROUPS.filter((g) => picks[`group:${g.id}`]).length;

  function signOut() {
    localStorage.removeItem("wc_token");
    localStorage.removeItem("wc_name");
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-green-950">
      <NavHeader
        className="border-b border-white/10"
        style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 50%, #0a1a0f 100%)" }}
        center={
          <div className="text-center select-none">
            <div className="leading-none">
              <span className="font-black text-white uppercase tracking-tight text-base">Johnsies </span>
              <span className="font-black text-amber-400 uppercase tracking-tight text-base">World Cup</span>
            </div>
            <div className="text-green-400 text-[9px] font-black uppercase tracking-[0.25em] mt-0.5">
              2026 · Family Bracket Challenge
            </div>
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
      {championTeam && (
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

      {/* Tab bar */}
      <div className="bg-brand-800 border-b border-brand-700 flex justify-center">
        {(["rules", "groups", "bracket"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 px-6 text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              tab === t
                ? "border-yellow-300 text-yellow-300"
                : "border-transparent text-green-500 hover:text-white hover:border-green-500"
            }`}
            style={tab !== t ? undefined : { textShadow: "0 0 16px rgba(253,224,71,0.7)" }}
          >
            {t === "groups" ? `Groups (${groupPickCount}/12)` : t === "bracket" ? "Knockout Bracket" : "The Rules"}
          </button>
        ))}
        <a
          href="/learn"
          className="py-3 px-6 text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap border-b-2 border-transparent text-green-500 hover:text-white hover:border-green-500 transition-all"
        >
          🌍 The World
        </a>
      </div>

      {/* Groups tab */}
      {tab === "groups" && (
        <div className="p-4 max-w-5xl mx-auto">
          <div className="mb-6 mt-2">
            <div className="text-[0.6rem] font-black uppercase tracking-[0.3em] text-green-600 mb-1.5">— Section</div>
            <h2 className="text-2xl font-black uppercase text-white leading-none" style={{ letterSpacing: "-0.01em" }}>The Group Stage</h2>
            <div className="mt-3 h-px bg-gradient-to-r from-yellow-300 via-green-600 to-transparent" />
            <p className="text-white/60 text-sm mt-3">
              Drag teams to rank all four finishing positions — top 2 advance to the knockout round.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GROUPS.map((group) => (
              <DraggableGroupCard key={group.id} group={group} picks={picks} onPick={handlePick} />
            ))}
          </div>
        </div>
      )}

      {/* Rules tab */}
      {tab === "rules" && <RulesTab />}

      {/* Bracket tab */}
      {tab === "bracket" && (
        <div className="p-4 overflow-x-auto">
          <p className="text-green-300 text-sm mb-4 text-center">
            Pick group winners first, then click teams here to advance them through the bracket.
          </p>
          <div className="flex gap-6 items-start min-w-max mx-auto pb-4">
            <KnockoutRound title="Round of 32" matches={r32matches.slice(0, 8)} picks={picks} onPick={handlePick} stage="r32" />
            <KnockoutRound title="Round of 16" matches={r16matches.slice(0, 4)} picks={picks} onPick={handlePick} stage="r16" />
            <KnockoutRound title="Quarters" matches={qfmatches.slice(0, 2)} picks={picks} onPick={handlePick} stage="qf" />
            <KnockoutRound title="Semis" matches={[sfmatches[0]]} picks={picks} onPick={handlePick} stage="sf" />
            <div className="flex flex-col items-center gap-4">
              <h3 className="font-bold text-yellow-400 text-center text-sm">🏆 Final</h3>
              {[finalMatch].map((match) => {
                const t1 = match.team1 ? getTeam(match.team1) : undefined;
                const t2 = match.team2 ? getTeam(match.team2) : undefined;
                const canPick = !!(t1 && t2);
                return (
                  <div key="final" className="flex flex-col items-center gap-1">
                    <SlotBox
                      label={t1 ? t1.name : "TBD"}
                      teamId={match.team1}
                      highlight={champion === match.team1}
                      onClick={canPick ? () => handlePick("final", "m1", match.team1!) : undefined}
                    />
                    <span className="text-white text-xs font-bold">vs</span>
                    <SlotBox
                      label={t2 ? t2.name : "TBD"}
                      teamId={match.team2}
                      highlight={champion === match.team2}
                      onClick={canPick ? () => handlePick("final", "m1", match.team2!) : undefined}
                    />
                    {champion && (() => { const ct = getTeam(champion); return ct ? (
                      <div className="mt-2 text-center flex flex-col items-center gap-1">
                        <FlagIcon cc={ct.cc} name={ct.name} className="w-14 h-10" />
                        <div className="text-yellow-400 font-bold text-xs">CHAMPION</div>
                      </div>
                    ) : null; })()}
                  </div>
                );
              })}
            </div>
            <KnockoutRound title="Semis" matches={[sfmatches[1]]} picks={picks} onPick={handlePick} stage="sf" />
            <KnockoutRound title="Quarters" matches={qfmatches.slice(2)} picks={picks} onPick={handlePick} stage="qf" />
            <KnockoutRound title="Round of 16" matches={r16matches.slice(4)} picks={picks} onPick={handlePick} stage="r16" />
            <KnockoutRound title="Round of 32" matches={r32matches.slice(8)} picks={picks} onPick={handlePick} stage="r32" />
          </div>
        </div>
      )}
    </div>
  );
}
