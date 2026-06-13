// Cron handler — triggered by cron-job.org every 15 minutes.
// Env vars: FOOTBALL_DATA_KEY, CRON_SECRET

import { NextRequest, NextResponse } from "next/server";
import { initDb, getSql } from "@/lib/db";
import { fetchCompletedMatchesForDate } from "@/lib/api-football";
import { processMatches } from "@/lib/process-matches";
import { syncGroupPoints } from "@/lib/sync-standings";

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
  // Query a 2-day UTC window (yesterday→today). The API dates matches by UTC
  // kickoff, so a match finishing just before 00:00 UTC would drop out of a
  // single-day query before the next cron run could pick it up. Processing is
  // idempotent (processed_fixtures), so re-fetching yesterday is harmless.
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  let matches;
  try {
    matches = await fetchCompletedMatchesForDate(yesterday, today);
  } catch (err) {
    console.error("[cron/results] fetch failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  const result = await processMatches(getSql(), matches);

  // Refresh every group's live points regardless of whether new matches landed,
  // so the score view stays current between fixtures. Non-fatal on failure.
  let pointsSynced = 0;
  try {
    ({ updated: pointsSynced } = await syncGroupPoints(getSql()));
  } catch (err) {
    console.warn("[cron/results] group points sync failed:", err);
  }

  return NextResponse.json({ dateFrom: yesterday, dateTo: today, pointsSynced, ...result });
}

export const POST = handler;
export const GET  = handler;
