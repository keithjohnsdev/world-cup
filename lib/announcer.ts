// The Gaffer — the message board's automated announcer.
//
// Detects the tournament's big moments and posts them to the message board so the
// family sees them in the chatter feed. Driven by the results-sync pipeline
// (lib/run-results-sync.ts), which already fetches every match with full-time
// scores; runAnnouncer() replays them but each event carries a stable event_key,
// so the every-few-minutes cron announces each moment exactly once
// (ON CONFLICT (event_key) DO NOTHING).
//
// Events:
//   • Knockout results        — "FULL TIME — Brazil beat Serbia 2–1 to reach …"
//   • Champion crashes out    — "Heartbreak for Mia — Brazil were her pick to win it all…"
//   • New leaderboard leader  — "New table-topper! Dad has taken over first place…"
//   • Phase changes           — kickoff, bracket opening, tournament complete

import { getSql } from "@/lib/db";
import type { RawMatch } from "@/lib/api-football";
import { apiNameToTeamId } from "@/lib/team-mapping";
import { getTeam } from "@/lib/data";
import { scoreUser, type UserRow, type PickRow, type ResultRow } from "@/lib/scoring";
import { kabooseRoundsForUser, type SnapshotRow } from "@/lib/snapshots";

type Sql = ReturnType<typeof getSql>;

// Display name for announcer posts. Rendered with its own styling on the board.
export const ANNOUNCER_NAME = "The Gaffer";

// Human round labels and what each knockout round advances the winner into.
const ROUND_LABEL: Record<string, string> = {
  "round of 32": "Round of 32",
  "round of 16": "Round of 16",
  "quarter-finals": "Quarter-finals",
  "semi-finals": "Semi-finals",
  final: "Final",
};
const ADVANCES_TO: Record<string, string> = {
  "round of 32": "the Round of 16",
  "round of 16": "the Quarter-finals",
  "quarter-finals": "the Semi-finals",
  "semi-finals": "the Final",
};

// Insert one announcer message, ignoring it if its event was already announced.
// Returns true only when a new row was actually written.
async function announce(sql: Sql, eventKey: string, body: string): Promise<boolean> {
  const rows = (await sql`
    INSERT INTO messages (user_id, user_name, body, is_announcer, event_key)
    VALUES (NULL, ${ANNOUNCER_NAME}, ${body}, true, ${eventKey})
    ON CONFLICT (event_key) DO NOTHING
    RETURNING id
  `) as { id: number }[];
  return rows.length > 0;
}

function teamName(id: string | null, fallback: string): string {
  return (id ? getTeam(id)?.name : null) ?? fallback;
}

// "Mia" · "Mia and Sam" · "Mia, Sam and Alex"
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function isKnockout(m: RawMatch): boolean {
  return (
    m.status === "FINISHED" &&
    m.round !== "group stage" &&
    !m.round.includes("3rd") &&
    !m.round.includes("third") &&
    Boolean(m.winnerName)
  );
}

// FULL TIME on a knockout tie — who won, who's going home, and the score.
async function announceKnockoutResult(sql: Sql, m: RawMatch): Promise<boolean> {
  const winnerId = apiNameToTeamId(m.winnerName);
  const homeId = apiNameToTeamId(m.homeTeamName);
  const awayId = apiNameToTeamId(m.awayTeamName);
  const loserId = winnerId === homeId ? awayId : homeId;

  const winner = teamName(winnerId, m.winnerName);
  const loser = teamName(loserId, winnerId === homeId ? m.awayTeamName : m.homeTeamName);

  // Winner-perspective full-time score, when goals are available.
  let wg: number | null = null;
  let lg: number | null = null;
  if (m.homeGoals != null && m.awayGoals != null) {
    if (winnerId === homeId) { wg = m.homeGoals; lg = m.awayGoals; }
    else { wg = m.awayGoals; lg = m.homeGoals; }
  }

  if (m.round === "final") {
    const score =
      m.wasShootout
        ? (wg != null ? ` (${wg}–${lg}, on penalties)` : " on penalties")
        : (wg != null ? ` ${wg}–${lg}` : "");
    const body = `🏆 FULL TIME — ${winner} are CHAMPIONS OF THE WORLD!${score} Glory to ${winner}! 🎉`;
    return announce(sql, `ko:${m.id}`, body);
  }

  const dest = ADVANCES_TO[m.round] ?? "the next round";
  let body: string;
  if (m.wasShootout) {
    const reg = wg != null ? ` (${wg}–${lg} after extra time)` : "";
    body = `⚽ FULL TIME — ${winner} edge ${loser} on penalties${reg} to reach ${dest}. 💔 ${loser} are out.`;
  } else {
    const score = wg != null ? ` ${wg}–${lg}` : "";
    body = `⚽ FULL TIME — ${winner} beat ${loser}${score} to reach ${dest}. 👋 ${loser} are out.`;
  }
  return announce(sql, `ko:${m.id}`, body);
}

// A knockout exit that knocks out somebody's pre-tournament champion pick.
async function announceChampionOut(
  sql: Sql,
  m: RawMatch,
  championPicks: { name: string; team_id: string }[],
): Promise<boolean> {
  const winnerId = apiNameToTeamId(m.winnerName);
  const homeId = apiNameToTeamId(m.homeTeamName);
  const awayId = apiNameToTeamId(m.awayTeamName);
  if (!winnerId || !homeId || !awayId) return false;
  const loserId = winnerId === homeId ? awayId : homeId;
  if (!loserId) return false;

  const fans = championPicks.filter((p) => p.team_id === loserId);
  if (fans.length === 0) return false;

  const loser = teamName(loserId, "");
  const round = ROUND_LABEL[m.round] ?? m.round;
  const who = joinNames(fans.map((f) => f.name));
  const body = `💔 Heartbreak for ${who} — ${loser} were picked to win it all, but they're OUT, knocked out in the ${round}.`;
  return announce(sql, `champ-out:${m.id}`, body);
}

// A new player at the top of the leaderboard. Recomputes the table exactly like
// /api/leaderboard, then compares against the last-announced leader (stored in
// tournament_settings) so we only shout when first place actually changes hands.
async function announceLeadChange(sql: Sql): Promise<boolean> {
  const [rawUsers, rawPicks, rawResults, rawSnapshots, rawPlayed, leaderRows] =
    (await Promise.all([
      sql`SELECT id, name, is_kid, chargeup_active, heart_pick_team_id FROM users`,
      sql`SELECT user_id, stage, slot, team_id, is_star_power FROM picks`,
      sql`SELECT stage, slot, team_id, was_shootout FROM results`,
      sql`SELECT round, user_id, rank, total_score, group_score, bracket_score FROM standings_snapshots`,
      sql`SELECT team_id FROM teams_played`,
      sql`SELECT value FROM tournament_settings WHERE key = 'announced_leader' LIMIT 1`,
    ])) as [
      UserRow[],
      (PickRow & { user_id: number })[],
      ResultRow[],
      SnapshotRow[],
      { team_id: string }[],
      { value: string }[],
    ];

  const playedTeams = new Set(rawPlayed.map((r) => r.team_id));
  const picksByUser = new Map<number, PickRow[]>();
  for (const row of rawPicks) {
    const { user_id, ...pick } = row;
    if (!picksByUser.has(user_id)) picksByUser.set(user_id, []);
    picksByUser.get(user_id)!.push(pick as PickRow);
  }

  const ranked = rawUsers
    .map((user) => {
      const kaboose = kabooseRoundsForUser(user.id, rawSnapshots);
      const b = scoreUser(user, picksByUser.get(user.id) ?? [], rawResults, kaboose, playedTeams);
      return { id: user.id, name: user.name, total: b.total };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const top = ranked[0];
  if (!top || top.total <= 0) return false; // nobody's on the board yet

  const prev = leaderRows[0]?.value ?? null;
  if (prev === String(top.id)) return false; // same leader — nothing to announce

  // Record the new leader first so a failed/duplicate post never re-fires.
  await sql`
    INSERT INTO tournament_settings (key, value)
    VALUES ('announced_leader', ${String(top.id)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;

  const body = prev
    ? `👑 New table-topper! ${top.name} has surged into first place with ${top.total} pts.`
    : `👑 ${top.name} is out in front with ${top.total} pts — first to lead the table!`;
  return announce(sql, `lead:${top.id}:${top.total}`, body);
}

// Main entry point — called from the results-sync pipeline after results change.
// `matches` is the full tournament match list (with scores) it already fetched.
// Best-effort: each step is isolated so one failure never blocks the others.
export async function runAnnouncer(sql: Sql, matches: RawMatch[]): Promise<number> {
  let posted = 0;

  const championPicks = (await sql`
    SELECT u.name, p.team_id
    FROM picks p JOIN users u ON u.id = p.user_id
    WHERE p.stage = 'champion' AND p.slot = 'pick'
  `) as { name: string; team_id: string }[];

  for (const m of matches) {
    if (!isKnockout(m)) continue;
    try {
      if (await announceKnockoutResult(sql, m)) posted++;
      if (await announceChampionOut(sql, m, championPicks)) posted++;
    } catch (err) {
      console.warn(`[announcer] match ${m.id} failed:`, err);
    }
  }

  try {
    if (await announceLeadChange(sql)) posted++;
  } catch (err) {
    console.warn("[announcer] lead-change check failed:", err);
  }

  return posted;
}

// Phase-transition announcements — the biggest moments of all. Called from the
// admin phase route. Each phase is announced once via its event_key.
const PHASE_MESSAGES: Record<string, string> = {
  phase1_locked:
    "🎉 KICKOFF! The World Cup is underway and group-stage picks are now locked. May the best Johnsie win! ⚽",
  phase2_open:
    "🔓 The bracket is OPEN! The group stage is done — head to Phase 2 and make your knockout picks.",
  phase2_locked: "🔒 Bracket picks are locked. From here on, it's all down to the football. Buckle up!",
  complete: "🏁 That's a wrap — the tournament is complete! Awards are being tallied. Thanks for playing, everyone.",
};

export async function announcePhaseChange(sql: Sql, phase: string): Promise<boolean> {
  const body = PHASE_MESSAGES[phase];
  if (!body) return false;
  return announce(sql, `phase:${phase}`, body);
}
