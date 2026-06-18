// News cron — triggered by cron-job.org every ~15 minutes.
// Runs the RSS news sync, and also an ungated results sync as a correctness
// backstop: the fast /api/cron/results gate only works during match windows, so
// this guarantees any late/missed result is still picked up within ~15 min.
// Env vars: FOOTBALL_DATA_KEY, CRON_SECRET

import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { runNewsSync } from "@/lib/run-news-sync";
import { runResultsSync } from "@/lib/run-results-sync";
import { runScheduledAnnouncements } from "@/lib/announcer";

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

  // Independent — a feed outage must never block the results backstop, and vice versa.
  const [news, results] = await Promise.allSettled([runNewsSync(), runResultsSync()]);

  if (news.status === "rejected") {
    console.error("[cron/news] news sync failed:", news.reason);
  }
  if (results.status === "rejected") {
    console.error("[cron/news] results backstop failed:", results.reason);
  }

  // Recurring time-based announcements (e.g. the Bama bit). Self-gated, so this is a
  // cheap no-op most ticks. Best-effort — never let it fail the cron response.
  let scheduled = 0;
  try {
    await initDb();
    scheduled = await runScheduledAnnouncements(getSql());
  } catch (err) {
    console.error("[cron/news] scheduled announcements failed:", err);
  }

  return NextResponse.json({
    news: news.status === "fulfilled" ? news.value : { error: String(news.reason) },
    results: results.status === "fulfilled" ? results.value : { error: String(results.reason) },
    scheduled,
  });
}

export const POST = handler;
export const GET  = handler;
