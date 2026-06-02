// Cron handler — triggered by cron-job.org every 15 minutes.
// Env vars: FOOTBALL_DATA_KEY, CRON_SECRET

import { NextRequest, NextResponse } from "next/server";
import { initDb, getSql } from "@/lib/db";
import { fetchCompletedMatchesForDate } from "@/lib/api-football";
import { processMatches } from "@/lib/process-matches";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return (
    req.headers.get("x-cron-secret") === secret ||
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.nextUrl.searchParams.get("secret") === secret
  );
}

export const dynamic = "force-dynamic";

async function handler(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDb();
  const dateStr = new Date().toISOString().slice(0, 10);

  let matches;
  try {
    matches = await fetchCompletedMatchesForDate(dateStr);
  } catch (err) {
    console.error("[cron/results] fetch failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  const result = await processMatches(getSql(), matches);
  return NextResponse.json({ date: dateStr, ...result });
}

export const POST = handler;
export const GET  = handler;
