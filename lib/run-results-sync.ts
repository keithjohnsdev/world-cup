// Core results-sync routine, shared by the scheduled cron handler
// (app/api/cron/results) and the manual admin trigger (app/api/admin/sync).
// Keeping it here ensures both paths run identical logic.

import { initDb, getSql } from "@/lib/db";
import { fetchCompletedMatchesForDate } from "@/lib/api-football";
import { processMatches } from "@/lib/process-matches";
import { syncGroupPoints } from "@/lib/sync-standings";

export async function runResultsSync() {
  await initDb();
  // Query a 2-day UTC window (yesterday→today). The API dates matches by UTC
  // kickoff, so a match finishing just before 00:00 UTC would drop out of a
  // single-day query before the next cron run could pick it up. Processing is
  // idempotent (processed_fixtures), so re-fetching yesterday is harmless.
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const matches = await fetchCompletedMatchesForDate(yesterday, today);

  const result = await processMatches(getSql(), matches);

  // Refresh every group's live points regardless of whether new matches landed,
  // so the score view stays current between fixtures. Non-fatal on failure.
  let pointsSynced = 0;
  try {
    ({ updated: pointsSynced } = await syncGroupPoints(getSql()));
  } catch (err) {
    console.warn("[results-sync] group points sync failed:", err);
  }

  return { dateFrom: yesterday, dateTo: today, pointsSynced, ...result };
}
