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
  const [rawUsers, rawPicks, rawResults] = await Promise.all([
    sql`SELECT name FROM users WHERE id = ${id}`,
    sql`SELECT stage, slot, team_id FROM picks
        WHERE user_id = ${id} AND stage IN ('group','runner','third','fourth')
        ORDER BY slot, stage`,
    sql`SELECT stage, slot, team_id FROM results
        WHERE stage IN ('group','runner','third','fourth')
        ORDER BY slot, stage`,
  ]);
  const userRows  = rawUsers   as { name: string }[];
  const pickRows  = rawPicks   as { stage: string; slot: string; team_id: string }[];
  const resultRows = rawResults as { stage: string; slot: string; team_id: string }[];

  if (!userRows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    name: (userRows[0] as { name: string }).name,
    picks: pickRows,
    results: resultRows,
  });
}
