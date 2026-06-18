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
//   • Leaderboard moves       — "Aria takes the lead!", "Emerson surges into 3rd place!"
//   • Phase changes           — kickoff, bracket opening, tournament complete

import { getSql } from "@/lib/db";
import type { RawMatch } from "@/lib/api-football";
import { apiNameToTeamId } from "@/lib/team-mapping";
import { getTeam } from "@/lib/data";
import { scoreUser, type UserRow, type PickRow, type ResultRow } from "@/lib/scoring";
import { kabooseRoundsForUser, type SnapshotRow } from "@/lib/snapshots";
import { voiceGaffer } from "@/lib/gaffer-voice";

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
//
// `plain` carries the correct facts; for genuinely new events we hand it to The
// Gaffer's voice (lib/gaffer-voice.ts) to be restyled in persona. We check for an
// existing row FIRST so the every-few-minutes cron never pays for an LLM call on
// an event it already announced; the ON CONFLICT remains a race guard.
async function announce(sql: Sql, eventKey: string, plain: string): Promise<boolean> {
  const existing = (await sql`
    SELECT 1 FROM messages WHERE event_key = ${eventKey} LIMIT 1
  `) as unknown[];
  if (existing.length > 0) return false;

  const body = await voiceGaffer(plain);
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

// Notable upward moves on the leaderboard. Recomputes the table exactly like
// /api/leaderboard, then diffs it against the last-announced ranking (a userId→rank
// map stored in tournament_settings) so we shout only when someone climbs into a
// spot worth shouting about:
//   • into 1st  — "Aria takes the lead with 84 pts!"
//   • into the podium (2nd/3rd, from outside the top 3) — "Emerson surges into 3rd place!"
// Internal podium shuffles (2nd⇄3rd) stay quiet to keep the feed signal-heavy.
const PODIUM = [
  { emoji: "🥈", label: "2nd" },
  { emoji: "🥉", label: "3rd" },
] as const;

async function announceLeaderboardMoves(sql: Sql): Promise<number> {
  const [rawUsers, rawPicks, rawResults, rawSnapshots, rawPlayed, rankRows] =
    (await Promise.all([
      sql`SELECT id, name, is_kid, chargeup_active, heart_pick_team_id FROM users`,
      sql`SELECT user_id, stage, slot, team_id, is_star_power FROM picks`,
      sql`SELECT stage, slot, team_id, was_shootout FROM results`,
      sql`SELECT round, user_id, rank, total_score, group_score, bracket_score FROM standings_snapshots`,
      sql`SELECT team_id FROM teams_played`,
      sql`SELECT value FROM tournament_settings WHERE key = 'announced_ranks' LIMIT 1`,
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

  // Rank exactly as the leaderboard does (total desc, then name) — array index +1
  // is the rank, matching what players see on the board.
  const ranked = rawUsers
    .map((user) => {
      const kaboose = kabooseRoundsForUser(user.id, rawSnapshots);
      const b = scoreUser(user, picksByUser.get(user.id) ?? [], rawResults, kaboose, playedTeams);
      return { id: user.id, name: user.name, total: b.total };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  if (ranked.length === 0 || ranked[0].total <= 0) return 0; // nobody on the board yet

  // Previous ranking we last announced from.
  let prevRanks: Record<string, number> = {};
  try {
    if (rankRows[0]?.value) prevRanks = JSON.parse(rankRows[0].value) as Record<string, number>;
  } catch { /* corrupt/empty — treat as no history */ }
  const hadHistory = Object.keys(prevRanks).length > 0;

  // Persist the new baseline first so a failed/duplicate post never re-fires.
  const newRanks: Record<string, number> = {};
  ranked.forEach((r, i) => { newRanks[String(r.id)] = i + 1; });
  await sql`
    INSERT INTO tournament_settings (key, value)
    VALUES ('announced_ranks', ${JSON.stringify(newRanks)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;

  // First time we ever have scores: greet the inaugural leader, but don't
  // retro-announce everyone's starting position.
  if (!hadHistory) {
    const top = ranked[0];
    const body = `👑 ${top.name} is out in front with ${top.total} pts — first to lead the table!`;
    return (await announce(sql, `lead:${top.id}:${top.total}`, body)) ? 1 : 0;
  }

  // Diff the top three for upward moves (score is monotonic, so :total in the
  // event_key lets a re-entry to the same spot later fire again).
  let posted = 0;
  for (let i = 0; i < ranked.length && i < 3; i++) {
    const r = ranked[i];
    if (r.total <= 0) break;
    const cur = i + 1;
    const prev = prevRanks[String(r.id)] ?? Infinity; // unseen player counts as "outside"
    if (cur >= prev) continue; // no improvement

    let body: string | null = null;
    if (cur === 1) {
      body = `👑 ${r.name} takes the lead with ${r.total} pts!`;
    } else if (prev > 3) {
      const { emoji, label } = PODIUM[cur - 2];
      body = `${emoji} ${r.name} surges into ${label} place with ${r.total} pts!`;
    }
    if (body && (await announce(sql, `rank:${r.id}:${cur}:${r.total}`, body))) posted++;
  }
  return posted;
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
    posted += await announceLeaderboardMoves(sql);
  } catch (err) {
    console.warn("[announcer] leaderboard-move check failed:", err);
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
