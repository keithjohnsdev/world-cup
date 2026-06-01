"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { GROUPS, getTeam, type Team } from "@/lib/data";
import { FlagIcon } from "@/components/FlagIcon";

type Picks = Record<string, string>; // key: "stage:slot" → teamId

function TeamButton({
  team,
  selected,
  onClick,
  size = "md",
}: {
  team: Team;
  selected: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full rounded-xl border-2 transition-all text-left
        ${size === "sm" ? "px-2 py-1.5 text-sm" : "px-3 py-2.5"}
        ${
          selected
            ? "border-green-500 bg-green-50 font-semibold text-green-800"
            : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 text-gray-700"
        }`}
    >
      <FlagIcon cc={team.cc} name={team.name} className={size === "sm" ? "w-5 h-4" : "w-7 h-5"} />
      <span className="truncate">{team.name}</span>
      {selected && <span className="ml-auto text-green-500">✓</span>}
    </button>
  );
}

function GroupCard({
  group,
  picks,
  onPick,
}: {
  group: (typeof GROUPS)[0];
  picks: Picks;
  onPick: (stage: string, slot: string, teamId: string) => void;
}) {
  const winner = picks[`group:${group.id}`];
  const runnerUp = picks[`runner:${group.id}`];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800 text-lg">{group.name}</h3>
        <div className="flex gap-1 text-xs text-gray-400">
          {winner && (() => { const t = getTeam(winner); return t ? (
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              1st: <FlagIcon cc={t.cc} name={t.name} className="w-5 h-3" />
            </span>
          ) : null; })()}
          {runnerUp && (() => { const t = getTeam(runnerUp); return t ? (
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              2nd: <FlagIcon cc={t.cc} name={t.name} className="w-5 h-3" />
            </span>
          ) : null; })()}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-2">Pick 1st place (required) and 2nd place (optional)</p>
      <div className="space-y-1.5">
        {group.teams.map((team) => {
          const isWinner = winner === team.id;
          const isRunner = runnerUp === team.id;
          return (
            <div key={team.id} className="flex gap-1.5">
              <button
                onClick={() => {
                  if (isWinner) {
                    onPick("group", group.id, "");
                  } else {
                    if (runnerUp === team.id) onPick("runner", group.id, "");
                    onPick("group", group.id, team.id);
                  }
                }}
                className={`flex-1 flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 transition-all text-left
                  ${isWinner ? "border-green-500 bg-green-50 font-semibold text-green-800" : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 text-gray-700"}`}
              >
                <FlagIcon cc={team.cc} name={team.name} className="w-7 h-5" />
                <span className="truncate text-sm">{team.name}</span>
                {isWinner && <span className="ml-auto text-green-500 font-bold">1st</span>}
              </button>
              <button
                onClick={() => {
                  if (isRunner) {
                    onPick("runner", group.id, "");
                  } else {
                    if (winner === team.id) onPick("group", group.id, "");
                    onPick("runner", group.id, team.id);
                  }
                }}
                className={`px-2 rounded-xl border-2 transition-all text-xs font-bold
                  ${isRunner ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white hover:border-blue-300 text-gray-400"}`}
                title="Pick as 2nd place"
              >
                2nd
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
    "border-gray-200 bg-white text-gray-300",
    "border-gray-200 bg-white text-gray-300",
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <h3 className="font-bold text-gray-800 text-lg mb-1">{group.name}</h3>
      <p className="text-xs text-gray-400 mb-3">Drag to rank — top 2 advance</p>
      <div ref={containerRef} className="space-y-1.5" style={{ touchAction: "none" }}>
        {order.map((team, index) => {
          const isDragging = dragging === index;
          const translateY = getTranslateY(index);
          const visualIndex =
            dragging !== null && insertAt !== null
              ? getVisualIndex(index, dragging, insertAt)
              : index;
          return (
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
              <span className="text-gray-300 text-lg leading-none">⠿</span>
              <FlagIcon cc={team.cc} name={team.name} className="w-7 h-5" />
              <span className="text-sm font-medium truncate">{team.name}</span>
              <span className={`ml-auto text-xs font-bold ${visualIndex < 2 ? "" : "opacity-30"}`}>
                {rankLabel[visualIndex]}
              </span>
            </div>
          );
        })}
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
    <section className="mb-10">
      <h2 className="text-xl font-bold text-green-900 border-b-2 border-green-200 pb-2 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-base font-bold text-green-800 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ScoreRow({ label, pts }: { label: string; pts: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-700">{label}</span>
      <span className="font-bold text-green-700 tabular-nums ml-4 shrink-0">{pts}</span>
    </div>
  );
}

function AwardRow({ name, description }: { name: string; description: string }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="font-semibold text-gray-900">{name}</div>
      <div className="text-sm text-gray-500 mt-0.5">{description}</div>
    </div>
  );
}

function PowerRow({ name, description }: { name: string; description: string }) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
      <span className="text-yellow-500 text-xl mt-0.5">⚡</span>
      <div>
        <div className="font-bold text-yellow-900">{name}</div>
        <div className="text-sm text-yellow-800 mt-0.5">{description}</div>
      </div>
    </div>
  );
}

function RulesTab() {
  const [zoom, setZoom] = useState<1 | 1.25 | 1.5>(1);
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex justify-end gap-1 mb-4">
          {([1, 1.25, 1.5] as const).map((z, i) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`rounded-lg px-2.5 py-1 font-bold leading-none transition-colors border
                ${zoom === z ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-500 border-gray-200 hover:border-green-400"}`}
              style={{ fontSize: `${0.75 + i * 0.15}rem` }}
              title={["Normal", "Large", "Extra large"][i]}
            >
              A
            </button>
          ))}
        </div>
      <div style={{ zoom }}>

        <p className="text-gray-600 leading-relaxed italic mb-8 px-1">
          Every four years, the world stops. Forty-eight nations travel from six continents to prove
          something — to themselves, to their history, to a billion people watching from living rooms
          and rooftops and corner bars. Underdogs do the impossible. Giants crumble. Heroes rise to
          etch their names in eternity. And somewhere in all of that chaos and beauty, somebody in
          this family is going to get it exactly right. This is your chance to be that person. Study
          the flags. Trust your gut. Make your picks. And when the final whistle blows in July, may
          your bracket be the last one standing.
        </p>

        <Section title="How It Works">
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="font-bold text-green-800 mb-1">Phase 1 — Group Stage Picks</div>
              <div className="text-sm text-gray-500 mb-2">Deadline: before the first match</div>
              <p className="text-sm">For each of the 12 groups, rank all four teams in finishing order (1st–4th). Also name your champion. Picks lock when the tournament begins.</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="font-bold text-green-800 mb-1">Phase 2 — Knockout Bracket Picks</div>
              <div className="text-sm text-gray-500 mb-2">Deadline: before the Round of 32</div>
              <p className="text-sm">Once the group stage is over, the real bracket is set. Everyone picks the knockout rounds fresh — Round of 32 through the Final — using the teams that actually qualified.</p>
            </div>
          </div>
        </Section>

        <Section title="Scoring">
          <Sub title="Group Stage">
            <div className="bg-white rounded-xl border border-gray-200 px-4 divide-y divide-gray-100">
              <ScoreRow label="1st or 2nd pick — team advances (any top-2 finish)" pts="2 pts" />
              <ScoreRow label="1st or 2nd pick — team in the exact position you picked" pts="+1 pt" />
              <ScoreRow label="3rd place pick — team finishes exactly 3rd" pts="1 pt" />
              <ScoreRow label="4th place pick — team finishes exactly 4th" pts="1 pt" />
              <ScoreRow label="Max per group" pts="8 pts" />
              <ScoreRow label="Max group stage total (12 groups)" pts="96 pts" />
            </div>
          </Sub>
          <Sub title="Knockout Rounds">
            <div className="bg-white rounded-xl border border-gray-200 px-4 divide-y divide-gray-100">
              <ScoreRow label="Round of 32" pts="3 pts" />
              <ScoreRow label="Round of 16" pts="6 pts" />
              <ScoreRow label="Quarterfinals" pts="12 pts" />
              <ScoreRow label="Semifinals" pts="24 pts" />
              <ScoreRow label="Final" pts="48 pts" />
            </div>
            <p className="text-xs text-gray-400 mt-2 px-1">Each round has the same total points available (48 pts). No round matters more than any other — they just feel like they do.</p>
          </Sub>
          <Sub title="Champion Bonus">
            <div className="bg-white rounded-xl border border-gray-200 px-4 divide-y divide-gray-100">
              <ScoreRow label="Your champion pick wins the tournament" pts="+10 pts" />
            </div>
            <p className="text-xs text-gray-400 mt-2 px-1">Named during Phase 1. The real reward is built into the bracket — this is just a little extra for calling it before a ball was kicked.</p>
          </Sub>
          <Sub title="Shootout Mercy Rule">
            <div className="bg-white rounded-xl border border-gray-200 px-4">
              <ScoreRow label="Your pick loses in a penalty shootout" pts="½ pts" />
            </div>
            <p className="text-xs text-gray-400 mt-2 px-1">Getting eliminated in the cruelest way possible shouldn&apos;t also cost you full points.</p>
          </Sub>
        </Section>

        <Section title="Awards">
          <p className="text-sm text-gray-500 mb-4">Everyone wins something. Awards are announced after the Final.</p>
          <Sub title="Glory">
            <div className="bg-white rounded-xl border border-gray-200 px-4 divide-y divide-gray-100">
              <AwardRow name="The Champion" description="Most total points overall" />
              <AwardRow name="True Believer" description="Named the actual World Cup winner as their champion pick before the tournament" />
              <AwardRow name="Group Stage Guru" description="Most points in the group stage — rewards knowing the obscure teams" />
              <AwardRow name="The Closer" description="Most points scored in the quarterfinals and beyond — peaked at the right time" />
              <AwardRow name="Dark Horse Whisperer" description="Named the lowest-ranked team to make the deepest run" />
              <AwardRow name="Bracket Brainiac" description="Highest accuracy percentage in the knockout rounds" />
              <AwardRow name="Dead Cert" description="Correctly predicted the winner of every group (1st place, all 12) — near impossible" />
            </div>
          </Sub>
          <Sub title="Funny &amp; Consolation">
            <div className="bg-white rounded-xl border border-gray-200 px-4 divide-y divide-gray-100">
              <AwardRow name="Wooden Spoon" description="Dead last — awarded with full ceremony and a literal wooden spoon" />
              <AwardRow name="Heartbreak Hotel" description="Most picks that lost specifically in penalty shootouts — the universe has a grudge" />
              <AwardRow name="The Human Coin Flip" description="Accuracy closest to exactly 50% — perfectly, uselessly neutral" />
              <AwardRow name="Help, I've Gone Cross-Eyed" description="Most picks where the team advanced but in the wrong position — so close, so often" />
              <AwardRow name="The Trendsetter" description="Made the most unique picks that nobody else made — a true contrarian" />
              <AwardRow name="Reverse Oracle" description="Most incorrect picks overall — so reliably wrong you're almost useful" />
            </div>
          </Sub>
          <Sub title="Skill">
            <div className="bg-white rounded-xl border border-gray-200 px-4 divide-y divide-gray-100">
              <AwardRow name="Perfect Round" description="Got every single pick correct in one round (any round counts)" />
              <AwardRow name="Upset Artist" description="Most correctly predicted upsets — lower-ranked team beats higher-ranked" />
              <AwardRow name="Crystal Ball" description="Most total correct picks by raw count across the whole tournament" />
            </div>
          </Sub>
          <Sub title="Special">
            <div className="bg-white rounded-xl border border-gray-200 px-4 divide-y divide-gray-100">
              <AwardRow name="Rookie Star" description="Best score among players age 10 and under — kids compete against each other" />
              <AwardRow name="Comeback Kid" description="Biggest point swing — most improved from the bottom half of the standings to the top" />
              <AwardRow name="The Commentator" description="Most enthusiastic trash-talker on the leaderboard (voted, not scored)" />
              <AwardRow name="The Hipster" description="Whose champion pick was the most obscure team that went the farthest — scored as seed × rounds advanced" />
            </div>
          </Sub>
        </Section>

        <Section title="Kid Powers ⚡">
          <p className="text-sm text-gray-500 mb-4">Players age 10 and under get special powers. Each can only be used once. Tell a grown-up before you use one.</p>
          <div className="space-y-3">
            <PowerRow name="Champion Boost" description="Your champion bonus is worth +20 pts instead of +10 if they win it all." />
            <PowerRow name="Comeback Chip" description="Starting a round in last place? You get 3 free bonus points. Automatic. Can happen more than once." />
            <PowerRow name="Heart Pick" description="Name your favorite team before the tournament. Every time they win any game — even ones you didn't pick — you earn 1 bonus point." />
            <PowerRow name="Star Power" description="Pick one game and declare it your Star Pick before it starts. Get it right and earn double points. One star. Use it well." />
          </div>
        </Section>

        <Section title="General Rules">
          <div className="bg-white rounded-xl border border-gray-200 px-4 divide-y divide-gray-100 text-sm text-gray-700">
            <div className="py-3">All picks must be submitted before the relevant deadline or they will not count.</div>
            <div className="py-3">Picks are final once locked, except where a Kid Power specifically allows otherwise.</div>
            <div className="py-3">In case of a tie, the co-champions may agree to share the title — or settle it the fun way: all the kids secretly hold up some fingers behind their backs. Each tied player guesses even or odd. Kids reveal. Whoever guesses right wins.</div>
            <div className="py-3">Awards are announced together after the Final.</div>
            <div className="py-3 font-medium">The Wooden Spoon is non-negotiable and must be accepted with grace.</div>
          </div>
        </Section>

      </div>
      </div>
    </div>
  );
}

export default function BracketPage() {
  const [picks, setPicks] = useState<Picks>({});
  const [tab, setTab] = useState<"groups" | "groups-drag" | "bracket" | "rules">("groups");
  const [userName, setUserName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const router = useRouter();

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

  const savePick = useCallback(async (stage: string, slot: string, teamId: string) => {
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": token },
      body: JSON.stringify({ stage, slot, teamId }),
    });
  }, []);

  function handlePick(stage: string, slot: string, teamId: string) {
    setPicks((prev) => {
      const key = `${stage}:${slot}`;
      if (!teamId) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: teamId };
    });
    if (teamId) savePick(stage, slot, teamId);
  }

  async function saveAll() {
    setSaving(true);
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    try {
      await Promise.all(
        Object.entries(picks).map(([key, teamId]) => {
          const [stage, slot] = key.split(":");
          return fetch("/api/picks", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-session-token": token },
            body: JSON.stringify({ stage, slot, teamId }),
          });
        })
      );
      setSaveMsg("All picks saved! ✓");
      setTimeout(() => setSaveMsg(""), 3000);
    } finally {
      setSaving(false);
    }
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
    <div className="min-h-screen bg-green-900">
      {/* Header */}
      <header className="bg-green-800 border-b border-green-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="text-white font-bold text-lg">🏆 WC 2026</span>
          {userName && <span className="text-green-300 text-sm ml-2">— {userName}</span>}
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && <span className="text-green-300 text-sm">{saveMsg}</span>}
          <button
            onClick={saveAll}
            disabled={saving}
            className="bg-green-600 hover:bg-green-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            {saving ? "Saving…" : "Save All"}
          </button>
          <button onClick={signOut} className="text-green-400 hover:text-white text-sm transition-colors">
            Sign out
          </button>
        </div>
      </header>

      {/* Champion banner */}
      {championTeam && (
        <div className="bg-yellow-400 text-yellow-900 text-center py-2 font-bold flex items-center justify-center gap-2">
          <span>🥇 Your champion pick:</span>
          <FlagIcon cc={championTeam.cc} name={championTeam.name} className="w-7 h-5" />
          <span>{championTeam.name}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-green-700 bg-green-800 px-4">
        <button
          onClick={() => setTab("groups")}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === "groups" ? "border-white text-white" : "border-transparent text-green-300 hover:text-white"
          }`}
        >
          Groups ({groupPickCount}/12)
        </button>
        <button
          onClick={() => setTab("groups-drag")}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === "groups-drag" ? "border-white text-white" : "border-transparent text-green-300 hover:text-white"
          }`}
        >
          Groups (drag)
        </button>
        <button
          onClick={() => setTab("bracket")}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === "bracket" ? "border-white text-white" : "border-transparent text-green-300 hover:text-white"
          }`}
        >
          Knockout Bracket
        </button>
        <button
          onClick={() => setTab("rules")}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === "rules" ? "border-white text-white" : "border-transparent text-green-300 hover:text-white"
          }`}
        >
          The Rules
        </button>
      </div>

      {/* Groups tab */}
      {tab === "groups" && (
        <div className="p-4 max-w-5xl mx-auto">
          <p className="text-green-300 text-sm mb-4 text-center">
            Click a team to pick them as group winner. Use "2nd" to pick the runner-up.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GROUPS.map((group) => (
              <GroupCard key={group.id} group={group} picks={picks} onPick={handlePick} />
            ))}
          </div>
        </div>
      )}

      {/* Groups (drag) tab */}
      {tab === "groups-drag" && (
        <div className="p-4 max-w-5xl mx-auto">
          <p className="text-green-300 text-sm mb-4 text-center">
            Drag teams to rank them — 1st and 2nd place advance to the knockout round.
          </p>
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
