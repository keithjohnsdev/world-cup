// Cron handler — triggered by cron-job.org every 15 minutes.
// Env vars: FOOTBALL_DATA_KEY, CRON_SECRET

import { NextRequest, NextResponse } from "next/server";
import { runResultsSync } from "@/lib/run-results-sync";
import { runNewsSync } from "@/lib/run-news-sync";

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
// Feed fetches can add a few seconds; give the function headroom past the default.
export const maxDuration = 30;

async function handler(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run results and news independently — a feed outage must never block scoring,
  // and a results error must never block news.
  const [results, news] = await Promise.allSettled([runResultsSync(), runNewsSync()]);

  if (results.status === "rejected") {
    console.error("[cron/results] results sync failed:", results.reason);
  }
  if (news.status === "rejected") {
    console.error("[cron/results] news sync failed:", news.reason);
  }

  return NextResponse.json({
    results: results.status === "fulfilled" ? results.value : { error: String(results.reason) },
    news: news.status === "fulfilled" ? news.value : { error: String(news.reason) },
  });
}

export const POST = handler;
export const GET  = handler;
