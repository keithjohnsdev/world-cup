// Test endpoint — inject fake match results through the real processing pipeline.
// Use this to verify cron logic before real matches start.
// Protected by CRON_SECRET. POST a body of { matches: CompletedMatch[] }.
//
// Example body for a Group A matchday 1 win:
// {
//   "matches": [{
//     "id": 99001,
//     "round": "group stage",
//     "matchday": 1,
//     "homeTeamName": "Mexico",
//     "awayTeamName": "South Africa",
//     "winnerName": "Mexico",
//     "wasShootout": false
//   }]
// }

import { NextRequest, NextResponse } from "next/server";
import { initDb, getSql } from "@/lib/db";
import { processMatches } from "@/lib/process-matches";
import type { CompletedMatch } from "@/lib/api-football";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.headers.get("x-cron-secret") ??
      req.nextUrl.searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let matches: CompletedMatch[];
  try {
    const body = await req.json();
    matches = body.matches;
    if (!Array.isArray(matches)) throw new Error("matches must be an array");
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  await initDb();
  const result = await processMatches(getSql(), matches);
  return NextResponse.json(result);
}
