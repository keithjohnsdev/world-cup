// Vercel Cron / external cron handler — polls API-Football for completed
// World Cup matches and writes results to the DB.
//
// Schedule: every 15 minutes during the tournament (June 11 – July 19 2026).
//   • Vercel Pro: set "*/15 * * * *" in vercel.json  ← recommended
//   • Vercel Hobby (daily limit only): use cron-job.org (free) pointing here
//     with header  Authorization: Bearer <CRON_SECRET>
//
// Env vars required:
//   API_FOOTBALL_KEY  — from api-football.com dashboard
//   CRON_SECRET       — any random string; set in Vercel + cron-job.org

import { NextRequest, NextResponse } from "next/server";
import { initDb, getSql } from "@/lib/db";
import { fetchFixturesByDate, fetchGroupStandings, ApiFix } from "@/lib/api-football";
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

export async function GET(req: NextRequest) {
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

  let fixtures: ApiFix[];
  try {
    fixtures = await fetchFixturesByDate(dateStr);
  } catch (err) {
    console.error("[cron/results] fetch fixtures failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  const completed = fixtures.filter((f) =>
    ["FT", "AET", "PEN"].includes(f.fixture.status.short),
  );

  const done: number[] = [];
  const skipped: number[] = [];
  const errors: { id: number; err: string }[] = [];

  for (const fix of completed) {
    const fid = fix.fixture.id;

    const already = await sql`
      SELECT 1 FROM processed_fixtures WHERE fixture_id = ${fid} LIMIT 1
    `;
    if (already.length > 0) { skipped.push(fid); continue; }

    try {
      const round = fix.league.round ?? "";
      const wasShootout = fix.fixture.status.short === "PEN";

      if (/group stage/i.test(round)) {
        await handleGroupFixture(sql, fix, fixtures);
      } else if (/3rd place|third place/i.test(round)) {
        // Skip 3rd-place play-off — not part of our bracket
      } else {
        await handleKnockoutFixture(sql, fix, wasShootout);
      }

      await sql`
        INSERT INTO processed_fixtures (fixture_id)
        VALUES (${fid})
        ON CONFLICT DO NOTHING
      `;
      done.push(fid);
    } catch (err) {
      console.error(`[cron/results] fixture ${fid}:`, err);
      errors.push({ id: fid, err: String(err) });
    }
  }

  return NextResponse.json({ date: dateStr, done, skipped, errors });
}

// ─── Group stage handler ───────────────────────────────────────────────────────
// Only finalises standings after the last group matchday (round "3"),
// once BOTH simultaneous group matches are complete.

async function handleGroupFixture(
  sql: ReturnType<typeof getSql>,
  fix: ApiFix,
  todayFixtures: ApiFix[],
) {
  // Only act on the final group matchday
  if (!/group stage.*3$/i.test(fix.league.round)) return;

  const homeId = apiNameToTeamId(fix.teams.home.name);
  const awayId = apiNameToTeamId(fix.teams.away.name);
  if (!homeId || !awayId) {
    throw new Error(`Unknown teams: "${fix.teams.home.name}" / "${fix.teams.away.name}"`);
  }

  const group = TEAMS.find((t) => t.id === homeId)?.group;
  if (!group) throw new Error(`No group found for team ${homeId}`);

  // Skip if standings already written for this group
  const existing = await sql`
    SELECT 1 FROM results WHERE stage = 'group' AND slot = ${group} LIMIT 1
  `;
  if (existing.length > 0) return;

  // Wait until both round-3 matches for this group are FT
  const groupTeamIds = new Set(
    GROUPS.find((g) => g.id === group)?.teams.map((t) => t.id) ?? [],
  );
  const round3ForGroup = todayFixtures.filter((f) => {
    if (!/group stage.*3$/i.test(f.league.round ?? "")) return false;
    const h = apiNameToTeamId(f.teams.home.name);
    const a = apiNameToTeamId(f.teams.away.name);
    return (h && groupTeamIds.has(h)) || (a && groupTeamIds.has(a));
  });

  const allDone = round3ForGroup.every((f) =>
    ["FT", "AET", "PEN"].includes(f.fixture.status.short),
  );
  if (!allDone) return;

  // Fetch standings and write all four positions
  const allStandings = await fetchGroupStandings();
  const entries = allStandings.get(group);
  if (!entries || entries.some((e) => e.all.played < 3)) {
    throw new Error(`Standings not final for group ${group}`);
  }

  const stageByRank = ["group", "runner", "third", "fourth"];
  for (const entry of entries) {
    const ourId = apiNameToTeamId(entry.team.name);
    if (!ourId) throw new Error(`Unknown standing team: "${entry.team.name}"`);
    const stage = stageByRank[entry.rank - 1];
    if (!stage) continue;
    await sql`
      INSERT INTO results (stage, slot, team_id, was_shootout)
      VALUES (${stage}, ${group}, ${ourId}, false)
      ON CONFLICT (stage, slot) DO UPDATE
        SET team_id = EXCLUDED.team_id
    `;
  }
}

// ─── Knockout handler ──────────────────────────────────────────────────────────
// Slot is derived from which teams are playing vs. known results —
// no separate fixture-mapping table needed.

async function handleKnockoutFixture(
  sql: ReturnType<typeof getSql>,
  fix: ApiFix,
  wasShootout: boolean,
) {
  const winner = fix.teams.home.winner === true ? fix.teams.home : fix.teams.away;
  const ourWinnerId = apiNameToTeamId(winner.name);
  if (!ourWinnerId) throw new Error(`Unknown winner: "${winner.name}"`);

  const team1Id = apiNameToTeamId(fix.teams.home.name);
  const team2Id = apiNameToTeamId(fix.teams.away.name);
  if (!team1Id || !team2Id) {
    throw new Error(`Unknown teams: "${fix.teams.home.name}" / "${fix.teams.away.name}"`);
  }

  // Build a results map so findKnockoutSlot can trace the bracket path
  const rows = await sql`SELECT stage, slot, team_id FROM results` as {
    stage: string; slot: string; team_id: string;
  }[];
  const resultsMap = new Map(rows.map((r) => [`${r.stage}:${r.slot}`, r.team_id]));

  const mapping = findKnockoutSlot(team1Id, team2Id, fix.league.round, resultsMap);
  if (!mapping) {
    throw new Error(
      `Cannot map fixture ${fix.fixture.id} (${fix.teams.home.name} vs ${fix.teams.away.name}) ` +
      `round="${fix.league.round}" to a bracket slot — group results may not be in DB yet`,
    );
  }

  const { stage, slot } = mapping;
  await sql`
    INSERT INTO results (stage, slot, team_id, was_shootout)
    VALUES (${stage}, ${slot}, ${ourWinnerId}, ${wasShootout})
    ON CONFLICT (stage, slot) DO UPDATE
      SET team_id = EXCLUDED.team_id,
          was_shootout = EXCLUDED.was_shootout
  `;
}
