import { NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  await initDb();
  const { userId } = await params;
  const id = parseInt(userId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

  const sql = getSql();
  const [rawUsers, rawPicks, rawStandings, rawHeartPick, rawChampionPick, rawPlayed, rawGroupPoints, rawBracketPicks, rawBracketResults] = await Promise.all([
    sql`SELECT name FROM users WHERE id = ${id}`,
    sql`SELECT stage, slot, team_id FROM picks
        WHERE user_id = ${id} AND stage IN ('group','runner','third','fourth')
        ORDER BY slot, stage`,
    sql`SELECT stage, slot, team_id FROM results
        WHERE stage IN ('group','runner','third','fourth')
        ORDER BY slot, stage`,
    sql`SELECT team_id FROM picks
        WHERE user_id = ${id} AND stage = 'heart' AND slot = 'pick' LIMIT 1`,
    sql`SELECT team_id FROM picks
        WHERE user_id = ${id} AND stage = 'champion' AND slot = 'pick' LIMIT 1`,
    sql`SELECT team_id FROM teams_played`,
    sql`SELECT team_id, points FROM group_points`,
    // Knockout picks + results power the Bracket score tab.
    sql`SELECT stage, slot, team_id, is_star_power FROM picks
        WHERE user_id = ${id} AND stage IN ('r32','r16','qf','sf','final')`,
    sql`SELECT stage, slot, team_id, was_shootout FROM results
        WHERE stage IN ('r32','r16','qf','sf','final')`,
  ]);

  const userRows = rawUsers    as { name: string }[];
  const pickRows = rawPicks    as { stage: string; slot: string; team_id: string }[];
  const results  = rawStandings as { stage: string; slot: string; team_id: string }[];
  const bracketPicks = rawBracketPicks as { stage: string; slot: string; team_id: string; is_star_power: boolean }[];
  const bracketResults = rawBracketResults as { stage: string; slot: string; team_id: string; was_shootout: boolean }[];
  const playedTeamIds = (rawPlayed as { team_id: string }[]).map((r) => r.team_id);
  const groupPoints = Object.fromEntries(
    (rawGroupPoints as { team_id: string; points: number }[]).map((r) => [r.team_id, r.points]),
  );

  if (!userRows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const heartPickTeamId = (rawHeartPick as { team_id: string }[])[0]?.team_id ?? null;
  const championPickTeamId = (rawChampionPick as { team_id: string }[])[0]?.team_id ?? null;

  // Count gm wins for the heart pick team
  let heartPoints = 0;
  if (heartPickTeamId) {
    const countRows = await sql`
      SELECT COUNT(*) AS count FROM results
      WHERE stage = 'gm' AND team_id = ${heartPickTeamId}
    ` as { count: string }[];
    heartPoints = parseInt(countRows[0]?.count ?? "0", 10);
  }

  return NextResponse.json({
    name: userRows[0].name,
    picks: pickRows,
    results,
    bracketPicks,
    bracketResults,
    heartPickTeamId,
    heartPoints,
    championPickTeamId,
    playedTeamIds,
    groupPoints,
  });
}
