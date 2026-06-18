// Core results-sync routine, shared by the scheduled cron handler
// (app/api/cron/results) and the manual admin trigger (app/api/admin/sync).
// Keeping it here ensures both paths run identical logic.

import { initDb, getSql } from "@/lib/db";
import { fetchCompletedMatchesForDate, fetchMatchesWindow, fetchAllMatches, type MatchWindowEntry } from "@/lib/api-football";
import { processMatches } from "@/lib/process-matches";
import { syncGroupPoints } from "@/lib/sync-standings";
import { rebuildPointsHistory } from "@/lib/points-history";
import { rebuildStats } from "@/lib/stats";
import { runAnnouncer } from "@/lib/announcer";

// Rebuild the derived points-history and stats snapshots after results change.
// Both consume the full match list, so we fetch it ONCE and share it — no extra
// API call. Each rebuild is non-fatal: a failure here must never lose a
// processed result. Skips entirely when nothing new landed.
async function rebuildDerivedIfChanged(processed: number) {
  if (processed <= 0) return;
  let matches;
  try {
    matches = await fetchAllMatches();
  } catch (err) {
    console.warn("[results-sync] fetchAllMatches for derived rebuild failed:", err);
    return;
  }
  try {
    await rebuildPointsHistory(getSql(), matches);
  } catch (err) {
    console.warn("[results-sync] points-history rebuild failed:", err);
  }
  try {
    await rebuildStats(matches, getSql());
  } catch (err) {
    console.warn("[results-sync] stats rebuild failed:", err);
  }
  // The Gaffer posts the day's big moments to the message board. Reuses the match
  // list we already fetched; idempotent via event_key so it's safe to re-run.
  try {
    await runAnnouncer(getSql(), matches);
  } catch (err) {
    console.warn("[results-sync] announcer failed:", err);
  }
}

const POST_MATCH_WINDOW_MS = 3 * 60 * 60 * 1000; // keep polling ~3h after kickoff (covers full-time + free-tier delay)
const WARMUP_MS = 10 * 60 * 1000;                 // start ~10 min before kickoff

function ymd(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 10);
}

// Is any match currently worth a full sync? Live now, recently finished (so a
// result we haven't picked up yet may have just landed), or kicking off shortly.
function isWindowActive(matches: MatchWindowEntry[]): boolean {
  const now = Date.now();
  return matches.some((m) => {
    if (m.status === "IN_PLAY" || m.status === "PAUSED") return true;
    const kickoff = m.utcDate ? new Date(m.utcDate).getTime() : NaN;
    if (isNaN(kickoff)) return false;
    if (m.status === "FINISHED") return now <= kickoff + POST_MATCH_WINDOW_MS;
    if (m.status === "TIMED" || m.status === "SCHEDULED") {
      const untilKickoff = kickoff - now;
      return untilKickoff > 0 && untilKickoff <= WARMUP_MS;
    }
    return false;
  });
}

// Match-aware gate for the fast (~2 min) cron. Makes ONE football-data call and,
// when nothing is in an active window, returns immediately with no DB access —
// keeping idle ticks cheap (protects Neon/Vercel free limits). The 15-min news
// cron runs the ungated runResultsSync() as a correctness backstop.
export async function runResultsSyncIfActive() {
  // yesterday → tomorrow covers matches straddling 00:00 UTC and their post-match window.
  const dateFrom = ymd(-86_400_000);
  const dateTo = ymd(86_400_000);

  const window = await fetchMatchesWindow(dateFrom, dateTo);
  if (!isWindowActive(window)) {
    return { idle: true as const };
  }

  // Active — now do the DB work, reusing the FINISHED matches we already fetched.
  await initDb();
  const finished = window.filter((m) => m.status === "FINISHED");
  const result = await processMatches(getSql(), finished);

  let pointsSynced = 0;
  try {
    ({ updated: pointsSynced } = await syncGroupPoints(getSql()));
  } catch (err) {
    console.warn("[results-sync] group points sync failed:", err);
  }

  await rebuildDerivedIfChanged(result.done.length);

  return { idle: false as const, dateFrom, dateTo, pointsSynced, ...result };
}

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

  await rebuildDerivedIfChanged(result.done.length);

  return { dateFrom: yesterday, dateTo: today, pointsSynced, ...result };
}
