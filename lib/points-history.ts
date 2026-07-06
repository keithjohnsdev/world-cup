// Points-history reconstruction. Replays every FINISHED World Cup match in
// chronological order, re-scoring all players after each one, and materialises
// the result into points_history. This is the SINGLE source of truth for the
// "points over time" graph — a full rebuild, so the table never drifts.
//
// Why reconstruct instead of read from the DB? Historic group standings aren't
// recoverable: process-matches upserts the group/runner/third/fourth rows to the
// *current* table, and gm rows store only winners (no scores, no draws). So we
// recompute group tables ourselves from match scores fetched from the API.

import { getSql } from "@/lib/db";
import { fetchAllMatches, type RawMatch } from "@/lib/api-football";
import { apiNameToTeamId } from "@/lib/team-mapping";
import { findKnockoutSlot } from "@/lib/bracket";
import { TEAMS } from "@/lib/data";
import { scoreUser, type UserRow, type PickRow, type ResultRow } from "@/lib/scoring";
import { kabooseRoundsForUser, type SnapshotRow } from "@/lib/snapshots";

type Sql = ReturnType<typeof getSql>;

const STAGE_BY_SLOT = ["group", "runner", "third", "fourth"] as const;

// A kid earns a Kaboose Boost by *starting* a knockout round in last place, so a
// round's boost may only count from the game that round begins — never earlier.
// Maps the knockout stage whose first result opens a round to that round's snapshot.
const SNAPSHOT_BY_STAGE: Record<string, string> = {
  r32: "pre_r32", r16: "pre_r16", qf: "pre_qf", sf: "pre_sf", final: "pre_final",
};

// Build a single group's table from the group matches played so far, returning
// team ids ordered 1st → 4th. Real criteria — points → goal difference → goals
// for — decide separated teams. EXACT ties (common in the early group stage:
// everyone on 1pt/0GD/0GF after a round of draws) aren't reproducible from match
// data; football-data breaks them by internal rules. So we break ties using
// `tieRank` (the *current* live standings order from the DB) as an anchor. That
// makes the reconstruction's current state match the leaderboard exactly, while
// genuinely-separated historical positions stay faithful to the actual results.
export function computeGroupStandings(
  matches: { homeId: string; awayId: string; homeGoals: number; awayGoals: number }[],
  groupId: string,
  tieRank?: Map<string, number>,
): string[] {
  const teams = TEAMS.filter((t) => t.group === groupId);
  const stats = new Map(teams.map((t) => [t.id, { pts: 0, gf: 0, ga: 0, seed: t.seed }]));

  for (const m of matches) {
    const h = stats.get(m.homeId);
    const a = stats.get(m.awayId);
    if (!h || !a) continue;
    h.gf += m.homeGoals; h.ga += m.awayGoals;
    a.gf += m.awayGoals; a.ga += m.homeGoals;
    if (m.homeGoals > m.awayGoals) h.pts += 3;
    else if (m.homeGoals < m.awayGoals) a.pts += 3;
    else { h.pts += 1; a.pts += 1; }
  }

  const rank = (id: string) => tieRank?.get(id) ?? 99;
  return [...stats.entries()]
    .sort(([idA, A], [idB, B]) =>
      B.pts - A.pts ||
      (B.gf - B.ga) - (A.gf - A.ga) ||
      B.gf - A.gf ||
      rank(idA) - rank(idB) ||
      A.seed - B.seed,
    )
    .map(([id]) => id);
}

function knockoutAbbr(round: string): string {
  const r = round.toLowerCase();
  if (r.includes("round of 32")) return "R32";
  if (r.includes("round of 16")) return "R16";
  if (r.includes("quarter")) return "QF";
  if (r.includes("semi")) return "SF";
  if (r === "final") return "Final";
  return round;
}

function makeLabel(match: RawMatch, homeId: string | null, awayId: string | null): string {
  const teams = `${homeId ?? "?"} v ${awayId ?? "?"}`;
  if (match.round === "group stage") return `MD${match.matchday ?? "?"} · ${teams}`;
  return `${knockoutAbbr(match.round)} · ${teams}`;
}

interface HistoryRow {
  user_id: number;
  game_index: number;
  fixture_id: number;
  match_utc: string;
  label: string;
  total: number;
  group_score: number;
  bracket_score: number;
}

// Recompute the whole points_history table from scratch. Idempotent.
// Accepts pre-fetched matches so callers (e.g. the cron) can share one
// fetchAllMatches() call across consumers; fetches itself when omitted.
export async function rebuildPointsHistory(sql: Sql, matches?: RawMatch[]): Promise<{ games: number; rows: number }> {
  const all = matches ?? await fetchAllMatches();
  const finished = all
    .filter((m) => m.status === "FINISHED" && m.hasResult !== false)
    .sort((a, b) =>
      a.utcDate < b.utcDate ? -1 : a.utcDate > b.utcDate ? 1 : a.id - b.id,
    );

  const [rawUsers, rawPicks, rawSnapshots, dbStandings] = (await Promise.all([
    sql`SELECT id, name, is_kid, chargeup_active, heart_pick_team_id FROM users`,
    sql`SELECT user_id, stage, slot, team_id, is_star_power FROM picks`,
    sql`SELECT round, user_id, rank, total_score, group_score, bracket_score FROM standings_snapshots`,
    sql`SELECT stage, team_id FROM results WHERE stage IN ('group','runner','third','fourth')`,
  ])) as [UserRow[], (PickRow & { user_id: number })[], SnapshotRow[], { stage: string; team_id: string }[]];

  // Tie-break anchor: each team's position in the *current* live standings, so the
  // reconstruction's present-day positions line up exactly with the leaderboard.
  const tieRank = new Map<string, number>();
  for (const r of dbStandings) {
    tieRank.set(r.team_id, STAGE_BY_SLOT.indexOf(r.stage as (typeof STAGE_BY_SLOT)[number]));
  }

  const picksByUser = new Map<number, PickRow[]>();
  for (const row of rawPicks) {
    const { user_id, ...pick } = row;
    if (!picksByUser.has(user_id)) picksByUser.set(user_id, []);
    picksByUser.get(user_id)!.push(pick as PickRow);
  }

  // Incremental tournament state, mirroring what process-matches writes to `results`.
  const resultRows = new Map<string, ResultRow>(); // "stage:slot" → row
  const groupMatches: { groupId: string; homeId: string; awayId: string; homeGoals: number; awayGoals: number }[] = [];
  const playedTeams = new Set<string>();

  // Which knockout rounds have begun so far in the replay. Gates Kaboose Boosts
  // so a boost is only credited from the game its round started — otherwise the
  // full boost would be back-applied to every earlier game (even the group stage),
  // masking the stretch a kid actually spent in last place.
  const startedRounds = new Set<string>();

  const history: HistoryRow[] = [];
  let gameIndex = 0;

  for (const match of finished) {
    const homeId = apiNameToTeamId(match.homeTeamName);
    const awayId = apiNameToTeamId(match.awayTeamName);
    let emit = false;

    if (match.round === "group stage") {
      if (homeId && awayId) {
        playedTeams.add(homeId);
        playedTeams.add(awayId);
        if (match.winnerName) {
          const winnerId = apiNameToTeamId(match.winnerName);
          if (winnerId) {
            resultRows.set(`gm:${match.id}`, { stage: "gm", slot: String(match.id), team_id: winnerId, was_shootout: false });
          }
        }
        const groupId = TEAMS.find((t) => t.id === homeId)?.group;
        if (groupId) {
          groupMatches.push({ groupId, homeId, awayId, homeGoals: match.homeGoals ?? 0, awayGoals: match.awayGoals ?? 0 });
          const standings = computeGroupStandings(groupMatches.filter((g) => g.groupId === groupId), groupId, tieRank);
          for (let i = 0; i < standings.length && i < STAGE_BY_SLOT.length; i++) {
            resultRows.set(`${STAGE_BY_SLOT[i]}:${groupId}`, { stage: STAGE_BY_SLOT[i], slot: groupId, team_id: standings[i], was_shootout: false });
          }
          emit = true;
        }
      }
    } else if (match.round.includes("3rd") || match.round.includes("third")) {
      // 3rd-place play-off — not scored (mirrors process-matches), no checkpoint.
    } else if (match.winnerName && homeId && awayId) {
      const winnerId = apiNameToTeamId(match.winnerName);
      const map = new Map([...resultRows.values()].map((r) => [`${r.stage}:${r.slot}`, r.team_id]));
      const mapping = findKnockoutSlot(homeId, awayId, match.round, map);
      if (winnerId && mapping) {
        // This round is now under way, so its Kaboose Boost may start counting.
        const snapshotRound = SNAPSHOT_BY_STAGE[mapping.stage];
        if (snapshotRound) startedRounds.add(snapshotRound);
        resultRows.set(`${mapping.stage}:${mapping.slot}`, { stage: mapping.stage, slot: mapping.slot, team_id: winnerId, was_shootout: match.wasShootout });
        emit = true;
      }
    }

    if (!emit) continue;
    gameIndex++;

    const results = [...resultRows.values()];
    const label = makeLabel(match, homeId, awayId);
    // Only snapshots for rounds that have already begun count toward the boost at
    // this point in the replay (see startedRounds). At the latest game every
    // taken snapshot is active, so the graph's present-day totals still match the
    // live leaderboard exactly — only the historical curve is corrected.
    const activeSnapshots = rawSnapshots.filter((s) => startedRounds.has(s.round));
    for (const user of rawUsers) {
      const kaboose = kabooseRoundsForUser(user.id, activeSnapshots);
      const bd = scoreUser(user, picksByUser.get(user.id) ?? [], results, kaboose, playedTeams);
      history.push({
        user_id: user.id,
        game_index: gameIndex,
        fixture_id: match.id,
        match_utc: match.utcDate,
        label,
        total: bd.total,
        group_score: bd.groupStage,
        bracket_score: bd.knockout,
      });
    }
  }

  // Clean rebuild: wipe and re-insert in one transaction so readers never see a
  // torn state. Bulk insert via unnest keeps it to a single round trip.
  if (history.length === 0) {
    await sql`DELETE FROM points_history`;
    return { games: gameIndex, rows: 0 };
  }

  await sql.transaction([
    sql`DELETE FROM points_history`,
    sql`
      INSERT INTO points_history (user_id, game_index, fixture_id, match_utc, label, total, group_score, bracket_score)
      SELECT * FROM unnest(
        ${history.map((h) => h.user_id)}::int[],
        ${history.map((h) => h.game_index)}::int[],
        ${history.map((h) => h.fixture_id)}::int[],
        ${history.map((h) => h.match_utc)}::timestamptz[],
        ${history.map((h) => h.label)}::text[],
        ${history.map((h) => h.total)}::int[],
        ${history.map((h) => h.group_score)}::int[],
        ${history.map((h) => h.bracket_score)}::int[]
      )
    `,
  ]);

  return { games: gameIndex, rows: history.length };
}
