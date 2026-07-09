// Core match-processing logic shared by the cron handler and the test endpoint.
// Takes an array of CompletedMatch objects and writes results to the DB.

import { getSql } from "@/lib/db";
import { fetchGroupStandings, type CompletedMatch } from "@/lib/api-football";
import { apiNameToTeamId } from "@/lib/team-mapping";
import { findKnockoutSlot } from "@/lib/bracket";
import { resolveThirdAssignment, type ThirdEntry } from "@/lib/thirds";
import { TEAMS } from "@/lib/data";
import { maybeSnapshotAfterStage } from "@/lib/snapshots";

type Sql = ReturnType<typeof getSql>;

export interface ProcessResult {
  done: number[];
  skipped: number[];
  errors: { id: number; err: string }[];
}

export async function processMatches(
  sql: Sql,
  matches: CompletedMatch[],
): Promise<ProcessResult> {
  const done: number[] = [];
  const skipped: number[] = [];
  const errors: { id: number; err: string }[] = [];

  for (const match of matches) {
    const mid = match.id;

    // A knockout match can never truly end in a draw — someone always advances
    // via extra time or penalties. But the free tier often reports a shootout
    // match as FINISHED with score.winner "DRAW" (the level regulation/ET score)
    // for a while before it enters the penalty winner. That yields hasResult=true
    // but an empty winnerName, which would otherwise fall through and get marked
    // processed with NO result row — permanently poisoning the fixture. Treat it
    // as unresolved: skip WITHOUT marking processed so a later run picks up the
    // real winner. (Group matches legitimately draw, so this only applies to KO.)
    const isKnockout =
      match.round !== "group stage" &&
      !match.round.includes("3rd") &&
      !match.round.includes("third");

    const already = await sql`
      SELECT 1 FROM processed_fixtures WHERE fixture_id = ${mid} LIMIT 1
    ` as unknown[];
    if (already.length > 0) {
      // Self-heal: a knockout result can get locked in with the WRONG winner if
      // the free-tier feed reported the match mid-shootout (see resolveWinnerName).
      // processed_fixtures would otherwise make that permanent — and a wrong winner
      // also blocks the next round from mapping. So when a processed knockout now
      // has a decisive winner that disagrees with what we stored, correct it.
      if (isKnockout && match.hasResult !== false && match.winnerName) {
        try {
          const changed = await reconcileKnockoutMatch(sql, match);
          if (changed) done.push(mid); else skipped.push(mid);
        } catch (err) {
          console.error(`[process-matches] reconcile ${mid}:`, err);
          errors.push({ id: mid, err: String(err) });
        }
      } else {
        skipped.push(mid);
      }
      continue;
    }

    // FINISHED but score.winner still null — API lag right after full-time.
    // Skip WITHOUT marking processed so the next cron run retries.
    if (match.hasResult === false) { skipped.push(mid); continue; }

    if (isKnockout && !match.winnerName) { skipped.push(mid); continue; }

    try {
      if (match.round === "group stage") {
        await handleGroupMatch(sql, match);
      } else if (match.round.includes("3rd") || match.round.includes("third")) {
        // Skip 3rd-place play-off
      } else if (match.winnerName) {
        await handleKnockoutMatch(sql, match);
      }

      await sql`
        INSERT INTO processed_fixtures (fixture_id)
        VALUES (${mid})
        ON CONFLICT DO NOTHING
      `;
      done.push(mid);

      // After each knockout result, check if the round just completed and
      // auto-snapshot standings for the next round.
      if (match.round !== "group stage" && match.winnerName) {
        const stageWritten = match.round.includes("round of 32") ? "r32"
          : match.round.includes("round of 16") ? "r16"
          : match.round.includes("quarter")     ? "qf"
          : match.round.includes("semi")        ? "sf"
          : match.round === "final"             ? "sf" // snapshot pre_final after both SFs
          : null;
        if (stageWritten) {
          await maybeSnapshotAfterStage(sql, stageWritten).catch((e) =>
            console.warn(`[process-matches] snapshot check failed for ${stageWritten}:`, e)
          );
        }
      }
    } catch (err) {
      console.error(`[process-matches] match ${mid}:`, err);
      errors.push({ id: mid, err: String(err) });
    }
  }

  return { done, skipped, errors };
}

async function handleGroupMatch(
  sql: Sql,
  match: CompletedMatch,
) {
  const homeId = apiNameToTeamId(match.homeTeamName);
  const awayId = apiNameToTeamId(match.awayTeamName);
  if (!homeId || !awayId) {
    throw new Error(`Unknown teams: "${match.homeTeamName}" / "${match.awayTeamName}"`);
  }

  // Write individual match result for every match with a winner (draws give no points)
  if (match.winnerName) {
    const winnerId = apiNameToTeamId(match.winnerName);
    if (!winnerId) throw new Error(`Unknown winner: "${match.winnerName}"`);
    await sql`
      INSERT INTO results (stage, slot, team_id, was_shootout)
      VALUES ('gm', ${String(match.id)}, ${winnerId}, false)
      ON CONFLICT (stage, slot) DO UPDATE SET team_id = EXCLUDED.team_id
    `;
  }

  // Update standings after every match so scores are live during the group stage.
  // Uses DO UPDATE so standings are overwritten as the group progresses.
  // Wrapped in try/catch so a standings API failure doesn't lose the gm row or
  // prevent the fixture from being marked processed.
  const group = TEAMS.find((t) => t.id === homeId)?.group;
  if (!group) throw new Error(`No group found for team ${homeId}`);

  try {
    const allStandings = await fetchGroupStandings();
    const entries = allStandings.get(group);
    if (!entries || entries.length === 0) return;

    // Assign slots by sorted table order, not raw position — the API reports tied
    // teams with the same position (e.g. two teams at 2), which would make them
    // fight over one slot and leave another slot empty.
    const sorted = [...entries].sort((a, b) => a.position - b.position);
    const stageBySlot = ["group", "runner", "third", "fourth"];
    for (let i = 0; i < sorted.length && i < stageBySlot.length; i++) {
      const ourId = apiNameToTeamId(sorted[i].teamName);
      if (!ourId) continue;
      const stage = stageBySlot[i];
      await sql`
        INSERT INTO results (stage, slot, team_id, was_shootout)
        VALUES (${stage}, ${group}, ${ourId}, false)
        ON CONFLICT (stage, slot) DO UPDATE SET team_id = EXCLUDED.team_id
      `;
      // Mirror live league points so the score view can show each team's
      // standing next to its "Actual" flag.
      await sql`
        INSERT INTO group_points (team_id, points, played_games, goal_diff, goals_for, updated_at)
        VALUES (${ourId}, ${sorted[i].points}, ${sorted[i].playedGames}, ${sorted[i].goalDifference}, ${sorted[i].goalsFor}, NOW())
        ON CONFLICT (team_id) DO UPDATE
          SET points = EXCLUDED.points,
              played_games = EXCLUDED.played_games,
              goal_diff = EXCLUDED.goal_diff,
              goals_for = EXCLUDED.goals_for,
              updated_at = NOW()
      `;
      // Record any team that has played a match so its group-stage pick can score.
      if (sorted[i].playedGames > 0) {
        await sql`
          INSERT INTO teams_played (team_id) VALUES (${ourId})
          ON CONFLICT DO NOTHING
        `;
      }
    }
  } catch (e) {
    console.warn(`[process-matches] standings update skipped for group ${group}:`, e);
  }
}

// Rank the third-placed teams from group_points and resolve the official R32
// assignment (winner group → third group), or null until the group stage is done.
async function computeThirdAssign(sql: Sql, resultsMap: Map<string, string>): Promise<Record<string, string> | null> {
  const gp = (await sql`
    SELECT team_id, points, played_games, goal_diff, goals_for FROM group_points
  `) as { team_id: string; points: number; played_games: number; goal_diff: number; goals_for: number }[];
  const stat = new Map(gp.map((r) => [r.team_id, r]));

  const entries: ThirdEntry[] = [];
  for (const g of "ABCDEFGHIJKL") {
    const teamId = resultsMap.get(`third:${g}`);
    if (!teamId) continue;
    const s = stat.get(teamId);
    if (!s) continue;
    entries.push({ group: g, teamId, points: s.points, goalDiff: s.goal_diff, goalsFor: s.goals_for, playedGames: s.played_games });
  }
  return resolveThirdAssignment(entries);
}

// Resolve a knockout match to its { stage, slot } + winning team id, using the
// current results table (and the derived third-place assignment for R32).
async function resolveKnockout(
  sql: Sql,
  match: CompletedMatch,
): Promise<{ stage: string; slot: string; winnerId: string }> {
  const ourWinnerId = apiNameToTeamId(match.winnerName);
  if (!ourWinnerId) throw new Error(`Unknown winner: "${match.winnerName}"`);

  const team1Id = apiNameToTeamId(match.homeTeamName);
  const team2Id = apiNameToTeamId(match.awayTeamName);
  if (!team1Id || !team2Id) {
    throw new Error(`Unknown teams: "${match.homeTeamName}" / "${match.awayTeamName}"`);
  }

  const rows = await sql`SELECT stage, slot, team_id FROM results` as {
    stage: string; slot: string; team_id: string;
  }[];
  const resultsMap = new Map(rows.map((r) => [`${r.stage}:${r.slot}`, r.team_id]));

  // Resolve which third-placed team faces each group winner (for R32 mapping).
  const thirdAssign = await computeThirdAssign(sql, resultsMap);
  const mapping = findKnockoutSlot(team1Id, team2Id, match.round, resultsMap, thirdAssign);
  if (!mapping) {
    throw new Error(
      `Cannot map match ${match.id} (${match.homeTeamName} vs ${match.awayTeamName}) ` +
      `round="${match.round}" to a slot`,
    );
  }

  return { stage: mapping.stage, slot: mapping.slot, winnerId: ourWinnerId };
}

async function handleKnockoutMatch(sql: Sql, match: CompletedMatch) {
  const { stage, slot, winnerId } = await resolveKnockout(sql, match);
  await sql`
    INSERT INTO results (stage, slot, team_id, was_shootout)
    VALUES (${stage}, ${slot}, ${winnerId}, ${match.wasShootout})
    ON CONFLICT (stage, slot) DO UPDATE
      SET team_id = EXCLUDED.team_id,
          was_shootout = EXCLUDED.was_shootout
  `;
}

// Re-check an already-processed knockout fixture against the current feed and
// correct its result row if the stored winner (or its shootout flag) disagrees.
// Returns true only when a row was actually changed, so the caller rebuilds
// derived tables only when something moved. A no-op when they already agree.
async function reconcileKnockoutMatch(sql: Sql, match: CompletedMatch): Promise<boolean> {
  const { stage, slot, winnerId } = await resolveKnockout(sql, match);
  const existing = await sql`
    SELECT team_id, was_shootout FROM results WHERE stage = ${stage} AND slot = ${slot} LIMIT 1
  ` as { team_id: string; was_shootout: boolean }[];
  const cur = existing[0];
  if (cur && cur.team_id === winnerId && cur.was_shootout === match.wasShootout) {
    return false; // already correct
  }
  await sql`
    INSERT INTO results (stage, slot, team_id, was_shootout)
    VALUES (${stage}, ${slot}, ${winnerId}, ${match.wasShootout})
    ON CONFLICT (stage, slot) DO UPDATE
      SET team_id = EXCLUDED.team_id,
          was_shootout = EXCLUDED.was_shootout
  `;
  console.warn(
    `[process-matches] reconciled ${stage}:${slot} for match ${match.id} — ` +
    `${cur ? `${cur.team_id} → ` : ""}${winnerId}`,
  );
  return true;
}
