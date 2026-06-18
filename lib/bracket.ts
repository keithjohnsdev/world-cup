// Shared bracket structure for the official 2026 FIFA World Cup knockout stage.
// Used by the bracket UI (BracketPicker) and by the cron to map real knockout
// results to slots (findKnockoutSlot) — both off this single source of truth.
//
// Round of 32: 4 group winners play runners-up, 8 winners play the best
// third-placed teams, and the remaining runners-up play each other. Which third a
// given winner faces depends on which 8 of 12 thirds qualify — resolved at runtime
// via lib/thirds.ts (ranking) + the Annex C table (lib/thirds-table.ts).
//
// The 16 R32 matches below are listed in BRACKET (depth-first) order, so the simple
// sequential pairing used for later rounds — r32 (m1,m2)→r16 m1, r16 (m1,m2)→qf m1,
// etc. — reproduces FIFA's official R16/QF/SF/Final tree exactly.

export type SlotSource =
  | { kind: "winner"; group: string }
  | { kind: "runner"; group: string }
  // For a third: `group` is the WINNER group whose Annex-C-assigned third fills this slot.
  | { kind: "third"; group: string };

export interface R32Match {
  slot: string; // m1..m16
  home: SlotSource;
  away: SlotSource;
}

// The 8 group winners that face a third-placed team, mapped to the groups eligible
// to supply that third (shown as "3rd · Group A/B/C…" before the assignment is set).
export const THIRD_ELIGIBLE: Record<string, string[]> = {
  E: ["A", "B", "C", "D", "F"],
  I: ["C", "D", "F", "G", "H"],
  A: ["C", "E", "F", "H", "I"],
  L: ["E", "H", "I", "J", "K"],
  D: ["B", "E", "F", "I", "J"],
  G: ["A", "E", "H", "I", "J"],
  B: ["E", "F", "G", "I", "J"],
  K: ["D", "E", "I", "J", "L"],
};

// R32 in bracket (DFS) order. Comments give FIFA's official match number.
export const R32_STRUCTURE: R32Match[] = [
  { slot: "m1",  home: { kind: "winner", group: "E" }, away: { kind: "third",  group: "E" } }, // M74
  { slot: "m2",  home: { kind: "winner", group: "I" }, away: { kind: "third",  group: "I" } }, // M77
  { slot: "m3",  home: { kind: "runner", group: "A" }, away: { kind: "runner", group: "B" } }, // M73
  { slot: "m4",  home: { kind: "winner", group: "F" }, away: { kind: "runner", group: "C" } }, // M75
  { slot: "m5",  home: { kind: "winner", group: "C" }, away: { kind: "runner", group: "F" } }, // M76
  { slot: "m6",  home: { kind: "runner", group: "E" }, away: { kind: "runner", group: "I" } }, // M78
  { slot: "m7",  home: { kind: "winner", group: "A" }, away: { kind: "third",  group: "A" } }, // M79
  { slot: "m8",  home: { kind: "winner", group: "L" }, away: { kind: "third",  group: "L" } }, // M80
  { slot: "m9",  home: { kind: "runner", group: "K" }, away: { kind: "runner", group: "L" } }, // M83
  { slot: "m10", home: { kind: "winner", group: "H" }, away: { kind: "runner", group: "J" } }, // M84
  { slot: "m11", home: { kind: "winner", group: "D" }, away: { kind: "third",  group: "D" } }, // M81
  { slot: "m12", home: { kind: "winner", group: "G" }, away: { kind: "third",  group: "G" } }, // M82
  { slot: "m13", home: { kind: "winner", group: "J" }, away: { kind: "runner", group: "H" } }, // M86
  { slot: "m14", home: { kind: "runner", group: "D" }, away: { kind: "runner", group: "G" } }, // M88
  { slot: "m15", home: { kind: "winner", group: "B" }, away: { kind: "third",  group: "B" } }, // M85
  { slot: "m16", home: { kind: "winner", group: "K" }, away: { kind: "third",  group: "K" } }, // M87
];

type ResultsMap = Map<string, string>; // "stage:slot" → team_id
type ThirdAssign = Record<string, string> | null | undefined; // winner group → third group

// Results-map key for a slot source (null for an unresolved third).
function sourceKey(s: SlotSource, thirdAssign: ThirdAssign): string | null {
  if (s.kind === "winner") return `group:${s.group}`;
  if (s.kind === "runner") return `runner:${s.group}`;
  const g = thirdAssign?.[s.group];
  return g ? `third:${g}` : null;
}

// The team currently occupying a slot source (undefined if not yet known).
export function teamForSource(s: SlotSource, results: ResultsMap, thirdAssign: ThirdAssign): string | undefined {
  const key = sourceKey(s, thirdAssign);
  return key ? results.get(key) : undefined;
}

// Human label for a slot source. An unresolved third shows the eligible groups.
export function sourceLabel(s: SlotSource, thirdAssign: ThirdAssign): { qualifier: string; detail: string } {
  if (s.kind === "winner") return { qualifier: "Winner", detail: `Group ${s.group}` };
  if (s.kind === "runner") return { qualifier: "Runner-up", detail: `Group ${s.group}` };
  const g = thirdAssign?.[s.group];
  if (g) return { qualifier: "3rd place", detail: `Group ${g}` };
  return { qualifier: "3rd place", detail: `Group ${(THIRD_ELIGIBLE[s.group] ?? []).join("/")}` };
}

export interface ResolvedMatch {
  slot: string;
  home: SlotSource;
  away: SlotSource;
  team1?: string;
  team2?: string;
}

// Resolve the 16 R32 matchups to concrete team ids (where known).
export function resolveR32(results: ResultsMap, thirdAssign: ThirdAssign): ResolvedMatch[] {
  return R32_STRUCTURE.map((m) => ({
    slot: m.slot,
    home: m.home,
    away: m.away,
    team1: teamForSource(m.home, results, thirdAssign),
    team2: teamForSource(m.away, results, thirdAssign),
  }));
}

function teamsMatch(a: string, b: string, t1: string, t2: string) {
  return (a === t1 && b === t2) || (a === t2 && b === t1);
}

// Given two team IDs and a round name, find the { stage, slot } for the match by
// comparing against results already stored. For the Round of 32, thirdAssign maps
// each winner group to its qualified third (from lib/thirds.ts).
export function findKnockoutSlot(
  team1: string,
  team2: string,
  round: string,
  results: ResultsMap,
  thirdAssign?: ThirdAssign,
): { stage: string; slot: string } | null {
  const r = round.toLowerCase();

  if (r.includes("round of 32")) {
    for (const m of resolveR32(results, thirdAssign)) {
      if (m.team1 && m.team2 && teamsMatch(m.team1, m.team2, team1, team2)) {
        return { stage: "r32", slot: m.slot };
      }
    }
    return null;
  }

  if (r.includes("round of 16")) {
    for (let i = 0; i < 8; i++) {
      const t1 = results.get(`r32:m${2 * i + 1}`);
      const t2 = results.get(`r32:m${2 * i + 2}`);
      if (t1 && t2 && teamsMatch(t1, t2, team1, team2)) return { stage: "r16", slot: `m${i + 1}` };
    }
    return null;
  }

  if (r.includes("quarter")) {
    for (let i = 0; i < 4; i++) {
      const t1 = results.get(`r16:m${2 * i + 1}`);
      const t2 = results.get(`r16:m${2 * i + 2}`);
      if (t1 && t2 && teamsMatch(t1, t2, team1, team2)) return { stage: "qf", slot: `m${i + 1}` };
    }
    return null;
  }

  if (r.includes("semi")) {
    for (let i = 0; i < 2; i++) {
      const t1 = results.get(`qf:m${2 * i + 1}`);
      const t2 = results.get(`qf:m${2 * i + 2}`);
      if (t1 && t2 && teamsMatch(t1, t2, team1, team2)) return { stage: "sf", slot: `m${i + 1}` };
    }
    return null;
  }

  if (r === "final") {
    const t1 = results.get("sf:m1");
    const t2 = results.get("sf:m2");
    if (t1 && t2 && teamsMatch(t1, t2, team1, team2)) return { stage: "final", slot: "m1" };
    return null;
  }

  return null;
}
