import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { MOCK_GROUP_RESULTS } from "@/lib/mock-results";

const MOCK_STANDINGS = MOCK_GROUP_RESULTS.filter(r =>
  ["group", "runner", "third", "fourth"].includes(r.stage)
);

export async function GET(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const [auth, rows, phaseRows] = await Promise.all([
    sql`SELECT id, name FROM users WHERE session_token = ${token}`,
    sql`SELECT stage, slot, team_id FROM results`,
    sql`SELECT value FROM tournament_settings WHERE key = 'phase' LIMIT 1`,
  ]);

  const authRows = auth as { id: number; name: string }[];
  if (!authRows.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phase = (phaseRows as { value: string }[])[0]?.value ?? "phase1_open";
  const isKeith = authRows[0].name.toLowerCase() === "keith";
  const previewActive = isKeith && phase !== "phase2_open" && phase !== "phase2_locked" && phase !== "complete";

  return NextResponse.json({
    results: previewActive ? MOCK_STANDINGS : rows,
    phase: previewActive ? "phase2_open" : phase,
    preview: previewActive,
  });
}
