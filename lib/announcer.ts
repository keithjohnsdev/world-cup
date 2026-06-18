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
import { getTeam, GROUPS } from "@/lib/data";
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

// A win counts as an upset when the winner is seeded this many places BELOW (weaker
// than) the team they beat. Lower seed number = stronger, so gap = winnerSeed - loserSeed.
const UPSET_SEED_GAP = 15;

// Point milestones worth a shout as players cross them (highest crossed fires once).
const POINT_MILESTONES = [50, 100, 150, 200, 250, 300, 400, 500];

// Match-based triggers only fire for matches that kicked off within this window. This
// is the anti-backfill guard: deploying mid-tournament must not replay every past
// result. A match's result lands within ~15 min of full time, so this is ample.
const RECENT_MATCH_MS = 6 * 60 * 60 * 1000;

function isRecentMatch(m: RawMatch): boolean {
  const kickoff = m.utcDate ? Date.parse(m.utcDate) : NaN;
  return Number.isFinite(kickoff) && Date.now() - kickoff <= RECENT_MATCH_MS;
}

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

// 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", 11 → "11th", …
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
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

// Recompute the leaderboard ranking exactly like /api/leaderboard (total desc, then
// name) — array index + 1 is the rank players see. Shared by the move detector and
// the recurring Bama bit.
async function rankPlayers(sql: Sql): Promise<{ id: number; name: string; total: number }[]> {
  const [rawUsers, rawPicks, rawResults, rawSnapshots, rawPlayed] = (await Promise.all([
    sql`SELECT id, name, is_kid, chargeup_active, heart_pick_team_id FROM users`,
    sql`SELECT user_id, stage, slot, team_id, is_star_power FROM picks`,
    sql`SELECT stage, slot, team_id, was_shootout FROM results`,
    sql`SELECT round, user_id, rank, total_score, group_score, bracket_score FROM standings_snapshots`,
    sql`SELECT team_id FROM teams_played`,
  ])) as [
    UserRow[],
    (PickRow & { user_id: number })[],
    ResultRow[],
    SnapshotRow[],
    { team_id: string }[],
  ];

  const playedTeams = new Set(rawPlayed.map((r) => r.team_id));
  const picksByUser = new Map<number, PickRow[]>();
  for (const row of rawPicks) {
    const { user_id, ...pick } = row;
    if (!picksByUser.has(user_id)) picksByUser.set(user_id, []);
    picksByUser.get(user_id)!.push(pick as PickRow);
  }

  return rawUsers
    .map((user) => {
      const kaboose = kabooseRoundsForUser(user.id, rawSnapshots);
      const b = scoreUser(user, picksByUser.get(user.id) ?? [], rawResults, kaboose, playedTeams);
      return { id: user.id, name: user.name, total: b.total };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

async function announceLeaderboardMoves(sql: Sql): Promise<number> {
  const ranked = await rankPlayers(sql);
  const rankRows = (await sql`
    SELECT value FROM tournament_settings WHERE key = 'announced_ranks' LIMIT 1
  `) as { value: string }[];

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

  // Big movers anywhere in the table since the last update. Surges of 3+ spots that
  // land OUTSIDE the podium (podium entries are already shouted above), and drops of
  // 4+ (never otherwise announced — a leader sliding is great chatter). The score in
  // the event_key lets a later move re-fire.
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    const cur = i + 1;
    const prev = prevRanks[String(r.id)];
    if (prev == null) continue; // no baseline for this player yet
    const climb = prev - cur; // positive = moved up the table
    if (climb >= 3 && cur > 3 && r.total > 0) {
      const body = `📈 ${r.name} is on the charge — up ${climb} spots to ${ordinal(cur)} with ${r.total} pts!`;
      if (await announce(sql, `surge:${r.id}:${cur}:${r.total}`, body)) posted++;
    } else if (climb <= -4) {
      const body = `📉 Ouch — ${r.name} slides ${-climb} spots down to ${ordinal(cur)} on the table.`;
      if (await announce(sql, `drop:${r.id}:${cur}:${r.total}`, body)) posted++;
    }
  }

  // Dead heat at the very top.
  if (ranked.length >= 2 && ranked[0].total > 0 && ranked[0].total === ranked[1].total) {
    const tied = ranked.filter((r) => r.total === ranked[0].total);
    const ids = tied.map((t) => t.id).sort((a, b) => a - b).join("-");
    const body = `🔥 Dead heat at the top — ${joinNames(tied.map((t) => t.name))} tied on ${ranked[0].total} pts!`;
    if (await announce(sql, `tie-top:${ranked[0].total}:${ids}`, body)) posted++;
  }

  // Points milestones — fire the highest one each player has newly crossed.
  for (const r of ranked) {
    const reached = POINT_MILESTONES.filter((m) => r.total >= m);
    if (reached.length === 0) continue;
    const top = reached[reached.length - 1];
    if (await announce(sql, `milestone:${r.id}:${top}`, `🎯 ${r.name} cracks ${top} pts!`)) posted++;
  }

  // Wooden-spoon watch — shout when the bottom of the table changes hands.
  const spoon = ranked[ranked.length - 1];
  if (spoon && ranked[0].total > 0) {
    const spoonRows = (await sql`
      SELECT value FROM tournament_settings WHERE key = 'announced_spoon' LIMIT 1
    `) as { value: string }[];
    if (spoonRows[0]?.value !== String(spoon.id)) {
      await sql`
        INSERT INTO tournament_settings (key, value)
        VALUES ('announced_spoon', ${String(spoon.id)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `;
      const body = `🥄 ${spoon.name} is now propping up the table — wooden-spoon duty for now.`;
      if (await announce(sql, `spoon:${spoon.id}:${spoon.total}`, body)) posted++;
    }
  }
  return posted;
}

// Seed-based upset, for ANY finished match (group or knockout): the winner is seeded
// at least UPSET_SEED_GAP places below the team they beat.
async function announceUpset(sql: Sql, m: RawMatch): Promise<boolean> {
  if (m.status !== "FINISHED" || !m.winnerName) return false;
  const winnerId = apiNameToTeamId(m.winnerName);
  const homeId = apiNameToTeamId(m.homeTeamName);
  const awayId = apiNameToTeamId(m.awayTeamName);
  if (!winnerId || !homeId || !awayId) return false;
  const loserId = winnerId === homeId ? awayId : homeId;
  const winner = getTeam(winnerId);
  const loser = getTeam(loserId);
  if (!winner || !loser) return false;
  if (winner.seed - loser.seed < UPSET_SEED_GAP) return false; // not a big enough gap

  let score = "";
  if (m.homeGoals != null && m.awayGoals != null) {
    const wg = winnerId === homeId ? m.homeGoals : m.awayGoals;
    const lg = winnerId === homeId ? m.awayGoals : m.homeGoals;
    score = m.wasShootout ? ` (${wg}–${lg} on penalties)` : ` ${wg}–${lg}`;
  }
  const body = `🚨 UPSET! ${winner.name} (seed ${winner.seed}) stun ${loser.name} (seed ${loser.seed})${score}.`;
  return announce(sql, `upset:${m.id}`, body);
}

// A knockout win that keeps someone's champion pick alive (the win-side counterpart to
// announceChampionOut). The Final win is already covered by the CHAMPIONS message.
async function announceChampionAdvance(
  sql: Sql,
  m: RawMatch,
  championPicks: { name: string; team_id: string }[],
): Promise<boolean> {
  if (m.round === "final" || !m.winnerName) return false;
  const winnerId = apiNameToTeamId(m.winnerName);
  if (!winnerId) return false;
  const fans = championPicks.filter((p) => p.team_id === winnerId);
  if (fans.length === 0) return false;
  const team = teamName(winnerId, m.winnerName);
  const dest = ADVANCES_TO[m.round] ?? "the next round";
  const body = `🏆 ${joinNames(fans.map((f) => f.name))}'s champion pick ${team} march on into ${dest} — still alive!`;
  return announce(sql, `champ-advance:${m.id}`, body);
}

// A kid's heart-pick team won a match (+1 for them). Fires for any round.
async function announceHeartPickWin(
  sql: Sql,
  m: RawMatch,
  heartFans: { name: string; team_id: string }[],
): Promise<boolean> {
  if (m.status !== "FINISHED" || !m.winnerName) return false;
  const winnerId = apiNameToTeamId(m.winnerName);
  if (!winnerId) return false;
  const fans = heartFans.filter((f) => f.team_id === winnerId);
  if (fans.length === 0) return false;
  const team = teamName(winnerId, m.winnerName);
  const body = `❤️ ${joinNames(fans.map((f) => f.name))}'s heart team ${team} win — +1!`;
  return announce(sql, `heart:${m.id}:${winnerId}`, body);
}

// "Matchday N is underway" — fires once per group-stage matchday, when its first
// result lands (we only see results, so it reads as 'underway', not pre-kickoff).
async function announceMatchdayUnderway(sql: Sql, matchday: number): Promise<boolean> {
  return announce(sql, `matchday:${matchday}`, `⚽ Matchday ${matchday} is underway — game on, Johnsies!`);
}

// Star Power resolved: a starred bracket pick whose match now has a result. Hit =
// double points; miss = it let them down. One shout per starred pick.
async function announceStarPower(sql: Sql): Promise<number> {
  const [starPicks, rawResults] = (await Promise.all([
    sql`SELECT u.id, u.name, p.stage, p.slot, p.team_id
        FROM picks p JOIN users u ON u.id = p.user_id
        WHERE p.is_star_power = true`,
    sql`SELECT stage, slot, team_id FROM results`,
  ])) as [
    { id: number; name: string; stage: string; slot: string; team_id: string }[],
    { stage: string; slot: string; team_id: string }[],
  ];

  const winners = new Map(rawResults.map((r) => [`${r.stage}:${r.slot}`, r.team_id]));
  let posted = 0;
  for (const sp of starPicks) {
    const winner = winners.get(`${sp.stage}:${sp.slot}`);
    if (winner == null) continue; // not resolved yet
    const team = teamName(sp.team_id, sp.team_id);
    const body =
      winner === sp.team_id
        ? `⭐ Star Pick PAYS OFF for ${sp.name} — ${team} deliver double points!`
        : `⭐ Star Pick goes begging for ${sp.name} — ${team} couldn't get it done.`;
    if (await announce(sql, `star:${sp.id}:${sp.stage}:${sp.slot}`, body)) posted++;
  }
  return posted;
}

// Which groups are FINAL (all four teams have played their 3 games) and the team in
// each finishing position, keyed by group letter.
async function finalGroupPositions(
  sql: Sql,
): Promise<Map<string, { actual: (string | null)[] }>> {
  const [rawResults, gp] = (await Promise.all([
    sql`SELECT stage, slot, team_id FROM results`,
    sql`SELECT team_id, played_games FROM group_points`,
  ])) as [{ stage: string; slot: string; team_id: string }[], { team_id: string; played_games: number }[]];

  const played = new Map(gp.map((r) => [r.team_id, r.played_games]));
  const positions = ["group", "runner", "third", "fourth"] as const;
  const out = new Map<string, { actual: (string | null)[] }>();
  for (const group of GROUPS) {
    const actual = positions.map(
      (pos) => rawResults.find((r) => r.stage === pos && r.slot === group.id)?.team_id ?? null,
    );
    const complete =
      actual.every(Boolean) && group.teams.every((t) => (played.get(t.id) ?? 0) >= 3);
    if (complete) out.set(group.id, { actual });
  }
  return out;
}

// Perfect group: a player nailed all four finishing positions in a now-final group
// (the maximum 8/8). One shout per player per group.
async function announcePerfectGroups(sql: Sql): Promise<number> {
  const finals = await finalGroupPositions(sql);
  if (finals.size === 0) return 0;

  const [rawPicks, users] = (await Promise.all([
    sql`SELECT user_id, stage, slot, team_id FROM picks
        WHERE stage IN ('group','runner','third','fourth')`,
    sql`SELECT id, name FROM users`,
  ])) as [
    { user_id: number; stage: string; slot: string; team_id: string }[],
    { id: number; name: string }[],
  ];

  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const positions = ["group", "runner", "third", "fourth"] as const;
  let posted = 0;
  for (const [groupId, { actual }] of finals) {
    // Group everyone's four picks for this group.
    const byUser = new Map<number, (string | null)[]>();
    for (const p of rawPicks) {
      if (p.slot !== groupId) continue;
      const idx = positions.indexOf(p.stage as (typeof positions)[number]);
      if (idx < 0) continue;
      if (!byUser.has(p.user_id)) byUser.set(p.user_id, [null, null, null, null]);
      byUser.get(p.user_id)![idx] = p.team_id;
    }
    for (const [userId, predicted] of byUser) {
      if (!predicted.every((id, i) => id != null && id === actual[i])) continue; // not perfect
      const name = nameById.get(userId);
      if (!name) continue;
      const body = `🎯 PERFECT GROUP! ${name} called all four spots in Group ${groupId} — a flawless 8/8.`;
      if (await announce(sql, `perfect:${userId}:${groupId}`, body)) posted++;
    }
  }
  return posted;
}

// The whole group stage is done — all 12 groups final. Fires once.
async function announceGroupStageComplete(sql: Sql): Promise<boolean> {
  const finals = await finalGroupPositions(sql);
  if (finals.size < GROUPS.length) return false;
  return announce(
    sql,
    "groups-complete",
    "🏁 The group stage is DONE — all 32 Round-of-32 places are booked. Knockout football, here we come!",
  );
}

// Main entry point — called from the results-sync pipeline after results change.
// `matches` is the full tournament match list (with scores) it already fetched.
// Best-effort: each step is isolated so one failure never blocks the others.
export async function runAnnouncer(sql: Sql, matches: RawMatch[]): Promise<number> {
  let posted = 0;

  const [championPicks, heartFans] = (await Promise.all([
    sql`SELECT u.name, p.team_id
        FROM picks p JOIN users u ON u.id = p.user_id
        WHERE p.stage = 'champion' AND p.slot = 'pick'`,
    sql`SELECT name, heart_pick_team_id AS team_id
        FROM users WHERE is_kid = true AND heart_pick_team_id IS NOT NULL`,
  ])) as [{ name: string; team_id: string }[], { name: string; team_id: string }[]];

  for (const m of matches) {
    if (m.status !== "FINISHED" || m.hasResult === false) continue;
    // Recency guard: don't backfill old results when new triggers ship mid-tournament.
    const recent = isRecentMatch(m);
    try {
      if (isKnockout(m)) {
        if (await announceKnockoutResult(sql, m)) posted++;
        if (await announceChampionOut(sql, m, championPicks)) posted++;
        if (recent && (await announceChampionAdvance(sql, m, championPicks))) posted++;
      }
      if (recent) {
        if (await announceUpset(sql, m)) posted++;
        if (await announceHeartPickWin(sql, m, heartFans)) posted++;
        if (m.round === "group stage" && m.matchday != null) {
          if (await announceMatchdayUnderway(sql, m.matchday)) posted++;
        }
      }
    } catch (err) {
      console.warn(`[announcer] match ${m.id} failed:`, err);
    }
  }

  // Standings-table-derived checks (don't need the match list). Each is isolated.
  for (const check of [announceStarPower, announcePerfectGroups]) {
    try {
      posted += await check(sql);
    } catch (err) {
      console.warn(`[announcer] ${check.name} failed:`, err);
    }
  }
  try {
    if (await announceGroupStageComplete(sql)) posted++;
  } catch (err) {
    console.warn("[announcer] group-stage-complete check failed:", err);
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

// Post a one-off, manually-triggered announcement in The Gaffer's voice — for
// moments that aren't auto-detected from results (e.g. a feature going live).
// `plain` carries the correct facts; it's restyled in persona and deduped by
// `eventKey`, so re-running is safe (it won't post twice).
export async function postGafferAnnouncement(
  sql: Sql,
  eventKey: string,
  plain: string,
): Promise<boolean> {
  return announce(sql, eventKey, plain);
}

// ── Recurring, time-based announcements ──────────────────────────────────────
// Not triggered by results — run from the 15-min news cron, self-gated on a stored
// timestamp. Currently just the Bama bit: every few days, a fresh fact about our
// darling for The Gaffer to lavish (or mock-mourn) over. Always yields a usable line.

const BAMA_NAME = "Bama";
const BAMA_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // ~every 3 days
const DIGEST_INTERVAL_MS = 23 * 60 * 60 * 1000;   // ~once a day (under 24h so it can't skip a day)

// Is one of Bama's group-winner picks currently dead last in its group? Returns the
// team/group if so — prime material for operatic Gaffer despair.
async function bamaGroupPickInLast(
  sql: Sql,
  bamaId: number,
): Promise<{ team: string; group: string } | null> {
  const [picks, gp] = (await Promise.all([
    sql`SELECT team_id FROM picks WHERE user_id = ${bamaId} AND stage = 'group'`,
    sql`SELECT team_id, points, goal_diff, goals_for, played_games FROM group_points`,
  ])) as [
    { team_id: string }[],
    { team_id: string; points: number; goal_diff: number; goals_for: number; played_games: number }[],
  ];

  const stat = new Map(gp.map((r) => [r.team_id, r]));
  for (const { team_id } of picks) {
    const team = getTeam(team_id);
    const pickStat = stat.get(team_id);
    if (!team || !pickStat || pickStat.played_games < 1) continue;
    // Rank the group by the same tiebreakers the bracket uses.
    const standings = (GROUPS.find((g) => g.id === team.group)?.teams ?? [])
      .map((t) => stat.get(t.id))
      .filter((s): s is NonNullable<typeof s> => s != null)
      .sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for);
    if (standings.length === 4 && standings[3].team_id === team_id) {
      return { team: team.name, group: team.group };
    }
  }
  return null;
}

// Build a single factual Bama line for The Gaffer to re-voice. Priority: wooden spoon
// if she's dead last, else a group pick face-planting, else her plain standing.
async function bamaPlainFact(sql: Sql): Promise<string | null> {
  const userRows = (await sql`
    SELECT id FROM users WHERE LOWER(name) = LOWER(${BAMA_NAME}) LIMIT 1
  `) as { id: number }[];
  const bamaId = userRows[0]?.id;
  if (bamaId == null) return null;

  const ranked = await rankPlayers(sql);
  const idx = ranked.findIndex((r) => r.id === bamaId);
  if (idx === -1) return null;
  const bama = ranked[idx];
  const pos = idx + 1;
  const n = ranked.length;

  if (n > 1 && pos === n) {
    return `🥄 Leaderboard check: Bama is dead last of ${n} players with ${bama.total} pts — currently holding the wooden spoon.`;
  }

  const flop = await bamaGroupPickInLast(sql, bamaId);
  if (flop) {
    return `😬 Bama watch: she picked ${flop.team} to win Group ${flop.group}, but they're rock bottom of the group right now.`;
  }

  if (pos === 1) {
    return `👑 Bama watch: she's sitting TOP of the leaderboard with ${bama.total} pts.`;
  }
  return `📊 Bama watch: she's ${ordinal(pos)} of ${n} on the leaderboard with ${bama.total} pts.`;
}

// Post the recurring Bama announcement if at least BAMA_INTERVAL_MS has passed since
// the last one. Self-gated via a stored timestamp; deduped per-day by event_key.
async function maybePostBama(sql: Sql): Promise<number> {
  const rows = (await sql`
    SELECT value FROM tournament_settings WHERE key = 'bama_last_announced' LIMIT 1
  `) as { value: string }[];
  const last = rows[0]?.value ? Date.parse(rows[0].value) : 0;
  if (Number.isFinite(last) && Date.now() - last < BAMA_INTERVAL_MS) return 0;

  const plain = await bamaPlainFact(sql);
  if (!plain) return 0;

  const dateKey = new Date().toISOString().slice(0, 10);
  const posted = await announce(sql, `bama:${dateKey}`, plain);

  // Advance the cadence whether or not this exact line was a dup, so we don't retry
  // every 15 min for the rest of the window.
  await sql`
    INSERT INTO tournament_settings (key, value)
    VALUES ('bama_last_announced', ${new Date().toISOString()})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
  return posted ? 1 : 0;
}

// Once-a-day "as it stands" snapshot: the podium plus the wooden spoon. Self-gated;
// only during live play (nothing to digest before kickoff or after the tournament).
async function maybePostStandingsDigest(sql: Sql): Promise<number> {
  const [tsRows, phaseRows] = (await Promise.all([
    sql`SELECT value FROM tournament_settings WHERE key = 'standings_digest_last' LIMIT 1`,
    sql`SELECT value FROM tournament_settings WHERE key = 'phase' LIMIT 1`,
  ])) as [{ value: string }[], { value: string }[]];

  const last = tsRows[0]?.value ? Date.parse(tsRows[0].value) : 0;
  if (Number.isFinite(last) && Date.now() - last < DIGEST_INTERVAL_MS) return 0;

  const phase = phaseRows[0]?.value ?? "phase1_open";
  if (phase === "phase1_open" || phase === "complete") return 0; // nothing meaningful yet/anymore

  const ranked = await rankPlayers(sql);
  if (ranked.length === 0 || ranked[0].total <= 0) return 0;

  const medals = ["🥇", "🥈", "🥉"];
  const top = ranked.slice(0, 3).map((r, i) => `${medals[i]} ${r.name} (${r.total})`).join("  ");
  const spoon = ranked[ranked.length - 1];
  const body = `📋 As it stands: ${top}  …  🥄 ${spoon.name} holds the wooden spoon.`;

  const dateKey = new Date().toISOString().slice(0, 10);
  const posted = await announce(sql, `digest:${dateKey}`, body);
  await sql`
    INSERT INTO tournament_settings (key, value)
    VALUES ('standings_digest_last', ${new Date().toISOString()})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
  return posted ? 1 : 0;
}

// All recurring, time-based announcements. Each self-gates, so this is a cheap no-op
// most ticks. Isolated so one failing check never blocks the others.
export async function runScheduledAnnouncements(sql: Sql): Promise<number> {
  let posted = 0;
  for (const check of [maybePostBama, maybePostStandingsDigest]) {
    try {
      posted += await check(sql);
    } catch (err) {
      console.warn(`[announcer] ${check.name} failed:`, err);
    }
  }
  return posted;
}
