// Shared bracket structure. Also used by the cron to derive knockout slots
// without a separate fixture_slots lookup table — slots are computed from
// which teams are playing, matched against known group results.

// R32 bracket pairs: [team1_group, team2_group]
//
// Encoding convention:
//   "X"  → 1st place (winner) of group X
//   "2X" → 2nd place (runner-up) of group X
//   "3X" → 3rd place of group X
//
// The 2026 World Cup has 32 R32 teams: 12 winners + 12 runners-up + 8 best 3rd-place.
// Matches m1–m12 cover all 12 groups (each appears exactly once as 1st and once as 2nd).
// Matches m13–m16 use 3rd-place picks from groups A–H as a simplified stand-in for
// the "8 best 3rd-place" bracket. Groups I–L don't contribute 3rd-place slots here.
//
// Result: zero duplicate teams in the R32.
export const BRACKET_PAIRS: [string, string][] = [
  // ── Section 1: Groups A–D ───────────────────────────────────────────────
  ["A",  "2B"],  // m1:  Group A 1st  vs Group B 2nd
  ["C",  "2D"],  // m2:  Group C 1st  vs Group D 2nd
  ["B",  "2A"],  // m3:  Group B 1st  vs Group A 2nd
  ["D",  "2C"],  // m4:  Group D 1st  vs Group C 2nd

  // ── Section 2: Groups E–H ───────────────────────────────────────────────
  ["E",  "2F"],  // m5:  Group E 1st  vs Group F 2nd
  ["G",  "2H"],  // m6:  Group G 1st  vs Group H 2nd
  ["F",  "2E"],  // m7:  Group F 1st  vs Group E 2nd
  ["H",  "2G"],  // m8:  Group H 1st  vs Group G 2nd

  // ── Section 3: Groups I–L ───────────────────────────────────────────────
  ["I",  "2J"],  // m9:  Group I 1st  vs Group J 2nd
  ["K",  "2L"],  // m10: Group K 1st  vs Group L 2nd
  ["J",  "2I"],  // m11: Group J 1st  vs Group I 2nd
  ["L",  "2K"],  // m12: Group L 1st  vs Group K 2nd

  // ── Section 4: Best 3rd-place bracket ──────────────────────────────────
  // Simplified: uses 3rd-place picks from groups A–H
  // (in the real tournament the 8 best 3rd-place teams from any group qualify)
  ["3A", "3B"],  // m13: Group A 3rd  vs Group B 3rd
  ["3C", "3D"],  // m14: Group C 3rd  vs Group D 3rd
  ["3E", "3F"],  // m15: Group E 3rd  vs Group F 3rd
  ["3G", "3H"],  // m16: Group G 3rd  vs Group H 3rd
];

// Decode a group code from BRACKET_PAIRS into { stage, letter }
function decodeGroup(code: string): { stage: "group" | "runner" | "third"; letter: string } {
  if (code.startsWith("3")) return { stage: "third",  letter: code.slice(1) };
  if (code.startsWith("2")) return { stage: "runner", letter: code.slice(1) };
  return { stage: "group", letter: code };
}

type ResultsMap = Map<string, string>; // "stage:slot" → team_id

function teamsMatch(a: string, b: string, t1: string, t2: string) {
  return (a === t1 && b === t2) || (a === t2 && b === t1);
}

// Given two team IDs and a round name, find the { stage, slot } for the match
// by comparing against results already stored.
export function findKnockoutSlot(
  team1: string,
  team2: string,
  round: string,
  results: ResultsMap,
): { stage: string; slot: string } | null {

  const r = round.toLowerCase();

  if (r.includes("round of 32")) {
    for (let i = 0; i < BRACKET_PAIRS.length; i++) {
      const { stage: s1, letter: l1 } = decodeGroup(BRACKET_PAIRS[i][0]);
      const { stage: s2, letter: l2 } = decodeGroup(BRACKET_PAIRS[i][1]);
      const t1 = results.get(`${s1}:${l1}`);
      const t2 = results.get(`${s2}:${l2}`);
      if (t1 && t2 && teamsMatch(t1, t2, team1, team2)) {
        return { stage: "r32", slot: `m${i + 1}` };
      }
    }
    return null;
  }

  if (r.includes("round of 16")) {
    for (let i = 0; i < 8; i++) {
      const t1 = results.get(`r32:m${2 * i + 1}`);
      const t2 = results.get(`r32:m${2 * i + 2}`);
      if (t1 && t2 && teamsMatch(t1, t2, team1, team2)) {
        return { stage: "r16", slot: `m${i + 1}` };
      }
    }
    return null;
  }

  if (r.includes("quarter")) {
    for (let i = 0; i < 4; i++) {
      const t1 = results.get(`r16:m${2 * i + 1}`);
      const t2 = results.get(`r16:m${2 * i + 2}`);
      if (t1 && t2 && teamsMatch(t1, t2, team1, team2)) {
        return { stage: "qf", slot: `m${i + 1}` };
      }
    }
    return null;
  }

  if (r.includes("semi")) {
    for (let i = 0; i < 2; i++) {
      const t1 = results.get(`qf:m${2 * i + 1}`);
      const t2 = results.get(`qf:m${2 * i + 2}`);
      if (t1 && t2 && teamsMatch(t1, t2, team1, team2)) {
        return { stage: "sf", slot: `m${i + 1}` };
      }
    }
    return null;
  }

  if (r === "final") {
    const t1 = results.get("sf:m1");
    const t2 = results.get("sf:m2");
    if (t1 && t2 && teamsMatch(t1, t2, team1, team2)) {
      return { stage: "final", slot: "m1" };
    }
    return null;
  }

  return null;
}
