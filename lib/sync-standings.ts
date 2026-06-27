// Mirror the full football-data.org group standings into the group_points table,
// independent of match processing. handleGroupMatch already does this for the
// group whose match just finished, but that only runs when there's an unprocessed
// fixture. This pulls every group's points in one shot, so the score view stays
// current even when no new matches are in the cron window (and backfills groups
// whose matches were already processed before group_points existed).

import { getSql } from "@/lib/db";
import { fetchGroupStandings } from "@/lib/api-football";
import { apiNameToTeamId } from "@/lib/team-mapping";

type Sql = ReturnType<typeof getSql>;

export async function syncGroupPoints(sql: Sql): Promise<{ updated: number }> {
  const allStandings = await fetchGroupStandings();
  let updated = 0;

  for (const [group, entries] of allStandings.entries()) {
    // Re-sort by table position so the standings order written to `results` stays
    // consistent with the points written to `group_points`. Without this, the
    // "Actual" column (driven by results) drifts out of sync with the points it
    // shows whenever a group's order changes between processed fixtures. The API
    // gives tied teams the same position, so sort by position alone — matching
    // handleGroupMatch — to keep both writers in agreement.
    const sorted = [...entries].sort((a, b) => a.position - b.position);
    const stageBySlot = ["group", "runner", "third", "fourth"];

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      const teamId = apiNameToTeamId(entry.teamName);
      if (!teamId) continue;
      await sql`
        INSERT INTO group_points (team_id, points, played_games, goal_diff, goals_for, updated_at)
        VALUES (${teamId}, ${entry.points}, ${entry.playedGames}, ${entry.goalDifference}, ${entry.goalsFor}, NOW())
        ON CONFLICT (team_id) DO UPDATE
          SET points = EXCLUDED.points,
              played_games = EXCLUDED.played_games,
              goal_diff = EXCLUDED.goal_diff,
              goals_for = EXCLUDED.goals_for,
              updated_at = NOW()
      `;
      // Keep the standings order in `results` current too, mirroring
      // handleGroupMatch's slot assignment.
      if (i < stageBySlot.length) {
        await sql`
          INSERT INTO results (stage, slot, team_id, was_shootout)
          VALUES (${stageBySlot[i]}, ${group}, ${teamId}, false)
          ON CONFLICT (stage, slot) DO UPDATE SET team_id = EXCLUDED.team_id
        `;
      }
      // Keep teams_played in sync too — a team can appear in standings as played
      // even if we never processed its specific fixture row.
      if (entry.playedGames > 0) {
        await sql`
          INSERT INTO teams_played (team_id) VALUES (${teamId})
          ON CONFLICT DO NOTHING
        `;
      }
      updated++;
    }
  }

  return { updated };
}
