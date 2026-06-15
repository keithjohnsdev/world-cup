// Fast results cron — triggered by cron-job.org every ~2 minutes.
// Match-aware gated: idle ticks make one cheap football-data call and return with
// no DB access; during match windows it runs the full results sync. News lives on
// its own slower schedule (/api/cron/news), which also runs an ungated backstop.
// Env vars: FOOTBALL_DATA_KEY, CRON_SECRET

import { NextRequest, NextResponse } from "next/server";
import { runResultsSyncIfActive } from "@/lib/run-results-sync";

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
export const maxDuration = 30;

async function handler(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runResultsSyncIfActive();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/results] sync failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export const POST = handler;
export const GET  = handler;
