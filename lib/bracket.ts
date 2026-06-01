// Shared bracket structure. Also used by the cron to derive knockout slots
// without a separate fixture_slots lookup table — slots are computed from
// which teams are playing, matched against known group results.

// R32 bracket pairs: [group_winner, group_runner_up]
// Index i → slot m{i+1}
export const BRACKET_PAIRS: [string, string][] = [
  ["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"],
  ["I", "J"], ["K", "L"], ["A", "C"], ["B", "D"],
  ["E", "G"], ["F", "H"], ["I", "K"], ["J", "L"],
  ["A", "D"], ["B", "C"], ["E", "H"], ["F", "G"],
];

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
      const [g1, g2] = BRACKET_PAIRS[i];
      const w = results.get(`group:${g1}`);
      const ru = results.get(`runner:${g2}`);
      if (w && ru && teamsMatch(w, ru, team1, team2)) {
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
