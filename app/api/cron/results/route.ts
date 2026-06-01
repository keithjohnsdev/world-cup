// Cron handler — triggered by cron-job.org every 15 minutes.
// cron-job.org is configured to POST:
//   https://johnsies.vercel.app/api/cron/results?secret=<CRON_SECRET>
//
// Env vars required:
//   FOOTBALL_DATA_KEY  — from football-data.org dashboard (free tier)
//   CRON_SECRET        — random secret set in both Vercel and cron-job.org URL

import { NextRequest, NextResponse } from "next/server";
import { initDb, getSql } from "@/lib/db";
import { fetchCompletedMatchesForDate, fetchGroupStandings, CompletedMatch } from "@/lib/api-football";
import { apiNameToTeamId } from "@/lib/team-mapping";
import { findKnockoutSlot } from "@/lib/bracket";
import { GROUPS, TEAMS } from "@/lib/data";

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev: skip auth
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.nextUrl.searchParams.get("secret") === secret
  );
}

// ─── Match window guard ────────────────────────────────────────────────────────
// WC 2026 matches kick off between ~18:00 and ~01:00 UTC.
// Skip API calls outside that window to conserve free-tier quota.

function inMatchWindow(d: Date): boolean {
  const h = d.getUTCHours();
  return h >= 17 || h < 3;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

async function handler(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  if (!inMatchWindow(now)) {
    return NextResponse.json({ skipped: "outside match window", utcHour: now.getUTCHours() });
  }

  await initDb();
  const sql = getSql();
  const dateStr = now.toISOString().slice(0, 10);

  let matches: CompletedMatch[];
  try {
    matches = await fetchCompletedMatchesForDate(dateStr);
  } catch (err) {
    console.error("[cron/results] fetch failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  const done: number[] = [];
  const skipped: number[] = [];
  const errors: { id: number; err: string }[] = [];

  for (const match of matches) {
    const mid = match.id;

    const already = await sql`
      SELECT 1 FROM processed_fixtures WHERE fixture_id = ${mid} LIMIT 1
    `;
    if (already.length > 0) { skipped.push(mid); continue; }

    try {
      if (match.round === "group stage") {
        await handleGroupMatch(sql, match, matches);
      } else if (match.round.includes("3rd") || match.round.includes("third")) {
        // Skip 3rd-place play-off — not part of our bracket
      } else {
        await handleKnockoutMatch(sql, match);
      }

      await sql`
        INSERT INTO processed_fixtures (fixture_id)
        VALUES (${mid})
        ON CONFLICT DO NOTHING
      `;
      done.push(mid);
    } catch (err) {
      console.error(`[cron/results] match ${mid}:`, err);
      errors.push({ id: mid, err: String(err) });
    }
  }

  return NextResponse.json({ date: dateStr, done, skipped, errors });
}

export const POST = handler;
export const GET  = handler;

// ─── Group stage ───────────────────────────────────────────────────────────────

async function handleGroupMatch(
  sql: ReturnType<typeof getSql>,
  match: CompletedMatch,
  todayMatches: CompletedMatch[],
) {
  // Only finalise standings on the last group matchday (3)
  if (match.matchday !== 3) return;

  const homeId = apiNameToTeamId(match.homeTeamName);
  const awayId = apiNameToTeamId(match.awayTeamName);
  if (!homeId || !awayId) {
    throw new Error(`Unknown teams: "${match.homeTeamName}" / "${match.awayTeamName}"`);
  }

  const group = TEAMS.find((t) => t.id === homeId)?.group;
  if (!group) throw new Error(`No group found for team ${homeId}`);

  // Skip if standings already written for this group
  const existing = await sql`
    SELECT 1 FROM results WHERE stage = 'group' AND slot = ${group} LIMIT 1
  `;
  if (existing.length > 0) return;

  // Wait until both matchday-3 matches for this group are in today's completed list
  const groupTeamIds = new Set(
    GROUPS.find((g) => g.id === group)?.teams.map((t) => t.id) ?? [],
  );
  const groupMatchday3 = todayMatches.filter((m) => {
    if (m.round !== "group stage" || m.matchday !== 3) return false;
    const h = apiNameToTeamId(m.homeTeamName);
    const a = apiNameToTeamId(m.awayTeamName);
    return (h && groupTeamIds.has(h)) || (a && groupTeamIds.has(a));
  });

  if (groupMatchday3.length < 2) return; // other match not done yet

  // Fetch final standings and write all four positions
  const allStandings = await fetchGroupStandings();
  const entries = allStandings.get(group);
  if (!entries || entries.some((e) => e.playedGames < 3)) {
    throw new Error(`Standings not final for group ${group}`);
  }

  const stageByPosition = ["group", "runner", "third", "fourth"];
  for (const entry of entries) {
    const ourId = apiNameToTeamId(entry.teamName);
    if (!ourId) throw new Error(`Unknown standing team: "${entry.teamName}"`);
    const stage = stageByPosition[entry.position - 1];
    if (!stage) continue;
    await sql`
      INSERT INTO results (stage, slot, team_id, was_shootout)
      VALUES (${stage}, ${group}, ${ourId}, false)
      ON CONFLICT (stage, slot) DO UPDATE SET team_id = EXCLUDED.team_id
    `;
  }
}

// ─── Knockout ──────────────────────────────────────────────────────────────────

async function handleKnockoutMatch(
  sql: ReturnType<typeof getSql>,
  match: CompletedMatch,
) {
  const ourWinnerId = apiNameToTeamId(match.winnerName);
  if (!ourWinnerId) throw new Error(`Unknown winner: "${match.winnerName}"`);

  const team1Id = apiNameToTeamId(match.homeTeamName);
  const team2Id = apiNameToTeamId(match.awayTeamName);
  if (!team1Id || !team2Id) {
    throw new Error(`Unknown teams: "${match.homeTeamName}" / "${match.awayTeamName}"`);
  }

  // Load all current results to derive the bracket slot
  const rows = await sql`SELECT stage, slot, team_id FROM results` as {
    stage: string; slot: string; team_id: string;
  }[];
  const resultsMap = new Map(rows.map((r) => [`${r.stage}:${r.slot}`, r.team_id]));

  const mapping = findKnockoutSlot(team1Id, team2Id, match.round, resultsMap);
  if (!mapping) {
    throw new Error(
      `Cannot map match ${match.id} (${match.homeTeamName} vs ${match.awayTeamName}) ` +
      `round="${match.round}" to a slot — group results may not be in DB yet`,
    );
  }

  const { stage, slot } = mapping;
  await sql`
    INSERT INTO results (stage, slot, team_id, was_shootout)
    VALUES (${stage}, ${slot}, ${ourWinnerId}, ${match.wasShootout})
    ON CONFLICT (stage, slot) DO UPDATE
      SET team_id = EXCLUDED.team_id,
          was_shootout = EXCLUDED.was_shootout
  `;
}
