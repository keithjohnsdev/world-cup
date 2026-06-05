import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"] as const;
const BRACKET_STAGES = ["r32","r16","qf","sf","final"] as const;
// r32=16, r16=8, qf=4, sf=2, final=1
const BRACKET_TOTAL = 31;
const GROUP_TOTAL = 12;

export async function GET(req: NextRequest) {
  await initDb();
  const sql = getSql();

  // Auth: must be Keith
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authRows = await sql`SELECT name FROM users WHERE session_token = ${token}` as { name: string }[];
  if (!authRows[0] || authRows[0].name.toLowerCase() !== "keith") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [users, picks, phaseRows] = await Promise.all([
    sql`SELECT id, name, created_at FROM users ORDER BY name ASC`,
    sql`SELECT user_id, stage, slot FROM picks`,
    sql`SELECT value FROM tournament_settings WHERE key = 'phase' LIMIT 1`,
  ]) as [
    { id: number; name: string; created_at: string }[],
    { user_id: number; stage: string; slot: string }[],
    { value: string }[],
  ];

  const phase = phaseRows[0]?.value ?? "phase1_open";

  // Index picks by user_id
  const picksByUser = new Map<number, { stage: string; slot: string }[]>();
  for (const p of picks) {
    if (!picksByUser.has(p.user_id)) picksByUser.set(p.user_id, []);
    picksByUser.get(p.user_id)!.push(p);
  }

  const players = users.map((u) => {
    const userPicks = picksByUser.get(u.id) ?? [];

    // Count complete groups (all 4 positions filled per letter)
    const groupsComplete = GROUPS.filter((letter) =>
      ["group","runner","third","fourth"].every((stage) =>
        userPicks.some((p) => p.stage === stage && p.slot === letter)
      )
    ).length;

    const championPicked = userPicks.some(
      (p) => p.stage === "champion" && p.slot === "pick"
    );

    const bracketPicks = userPicks.filter((p) =>
      BRACKET_STAGES.includes(p.stage as typeof BRACKET_STAGES[number])
    ).length;

    return {
      id: u.id,
      name: u.name,
      groupsComplete,           // 0–12
      groupsDone: groupsComplete === GROUP_TOTAL && championPicked,
      championPicked,
      bracketPicks,             // 0–31
      bracketDone: bracketPicks === BRACKET_TOTAL,
      joinedAt: u.created_at,
    };
  });

  return NextResponse.json({ players, phase, bracketTotal: BRACKET_TOTAL });
}
