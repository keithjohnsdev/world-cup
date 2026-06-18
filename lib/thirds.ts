// Best third-placed teams → official Round-of-32 slot assignment.
//
// FIFA's 2026 format advances the 8 best of the 12 third-placed teams. Which 8
// qualify is decided by a cross-group ranking; which group-winner each then faces
// is fixed by Annex C (the 495-row table in lib/thirds-table.ts). This module
// ranks the thirds and resolves that assignment.

import { THIRD_PLACE_TABLE, THIRD_WINNERS } from "@/lib/thirds-table";

export interface ThirdEntry {
  group: string; // group letter A..L
  teamId: string; // the 3rd-placed team's id
  points: number;
  goalDiff: number;
  goalsFor: number;
  playedGames: number;
}

// Rank third-placed teams by FIFA tiebreakers: points, goal difference, goals for.
// Falls back to group letter for a stable, deterministic order (standing in for the
// fair-play / drawing-of-lots tiebreakers we can't compute from standings alone).
export function rankThirds(entries: ThirdEntry[]): ThirdEntry[] {
  return [...entries].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.group.localeCompare(b.group),
  );
}

// Resolve which third-placed GROUP each of the 8 relevant group winners faces in
// the Round of 32. Returns a map of winner-group → third-group (e.g. { A: "E", ... }),
// or null when it can't be determined yet — i.e. fewer than 12 thirds known, or the
// group stage isn't complete (a team plays 3 group games), so the ranking isn't final.
export function resolveThirdAssignment(entries: ThirdEntry[]): Record<string, string> | null {
  if (entries.length < 12) return null;
  if (!entries.every((e) => e.playedGames >= 3)) return null;

  const best8 = rankThirds(entries)
    .slice(0, 8)
    .map((e) => e.group);
  const key = [...best8].sort().join("");
  const row = THIRD_PLACE_TABLE[key];
  if (!row) return null; // every 8-of-12 combination is in the table, so this is defensive

  const assign: Record<string, string> = {};
  THIRD_WINNERS.forEach((w, i) => { assign[w] = row[i]; });
  return assign;
}
