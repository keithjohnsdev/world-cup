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

  for (const entries of allStandings.values()) {
    for (const entry of entries) {
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
