// Core match-processing logic shared by the cron handler and the test endpoint.
// Takes an array of CompletedMatch objects and writes results to the DB.

import { getSql } from "@/lib/db";
import { fetchGroupStandings, type CompletedMatch } from "@/lib/api-football";
import { apiNameToTeamId } from "@/lib/team-mapping";
import { findKnockoutSlot } from "@/lib/bracket";
import { GROUPS, TEAMS } from "@/lib/data";
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

    const already = await sql`
      SELECT 1 FROM processed_fixtures WHERE fixture_id = ${mid} LIMIT 1
    ` as unknown[];
    if (already.length > 0) { skipped.push(mid); continue; }

    // FINISHED but score.winner still null — API lag right after full-time.
    // Skip WITHOUT marking processed so the next cron run retries.
    if (match.hasResult === false) { skipped.push(mid); continue; }

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
    }
  } catch (e) {
    console.warn(`[process-matches] standings update skipped for group ${group}:`, e);
  }
}

async function handleKnockoutMatch(sql: Sql, match: CompletedMatch) {
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

  const mapping = findKnockoutSlot(team1Id, team2Id, match.round, resultsMap);
  if (!mapping) {
    throw new Error(
      `Cannot map match ${match.id} (${match.homeTeamName} vs ${match.awayTeamName}) ` +
      `round="${match.round}" to a slot`,
    );
  }

  const { stage, slot } = mapping;
  await sql`
    INSERT INTO results (stage, slot, team_id, was_shootout)
    VALUES (${stage}, ${slot}, ${ourWinnerId}, ${match.wasShootout})
    ON CONFLICT (stage, slot) DO UPDATE
      SET team_id = EXCLUDED.team_id,
          was_shootout = EXCLUDED.was_shootout
  `;
}
