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
  const [rawUsers, rawPicks, rawStandings, rawHeartPick] = await Promise.all([
    sql`SELECT name FROM users WHERE id = ${id}`,
    sql`SELECT stage, slot, team_id FROM picks
        WHERE user_id = ${id} AND stage IN ('group','runner','third','fourth')
        ORDER BY slot, stage`,
    sql`SELECT stage, slot, team_id FROM results
        WHERE stage IN ('group','runner','third','fourth')
        ORDER BY slot, stage`,
    sql`SELECT team_id FROM picks
        WHERE user_id = ${id} AND stage = 'heart' AND slot = 'pick' LIMIT 1`,
  ]);

  const userRows = rawUsers    as { name: string }[];
  const pickRows = rawPicks    as { stage: string; slot: string; team_id: string }[];
  const results  = rawStandings as { stage: string; slot: string; team_id: string }[];

  if (!userRows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const heartPickTeamId = (rawHeartPick as { team_id: string }[])[0]?.team_id ?? null;

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
    heartPickTeamId,
    heartPoints,
  });
}
