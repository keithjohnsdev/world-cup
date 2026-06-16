// Stats / fun-facts engine. Computes a set of interesting & surprising records
// about World Cup 2026 so far — both tournament facts (goals, upsets, blowouts)
// and pool facts (our players' picks vs reality). All derived for FREE from data
// we already have: match scores (fetchAllMatches), team seeds, and the picks /
// standings / points-history tables. Rebuilt by the results cron when results
// change; materialised into the single stats_snapshot row.

import { createHash } from "crypto";
import { getSql } from "@/lib/db";
import { type RawMatch } from "@/lib/api-football";
import { apiNameToTeamId } from "@/lib/team-mapping";
import { TEAMS } from "@/lib/data";

type Sql = ReturnType<typeof getSql>;

export interface Stat {
  key: string;
  category: "tournament" | "pool";
  emoji: string;
  title: string;
  value: string;           // templated headline fact, always present
  detail?: string;         // short secondary line
  explanation?: string;    // fuller paragraph shown in the click-through popup
  teamIds?: string[];
  signature: string;       // hash of key|value|detail → flavor cache key
}

const TEAM_BY_ID = new Map(TEAMS.map((t) => [t.id, t]));
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

function roundLabel(round: string): string {
  const r = round.toLowerCase();
  if (r === "group stage") return "Group Stage";
  if (r.includes("round of 32")) return "Round of 32";
  if (r.includes("round of 16")) return "Round of 16";
  if (r.includes("quarter")) return "Quarter-final";
  if (r.includes("semi")) return "Semi-final";
  if (r === "final") return "Final";
  return round;
}

function sig(key: string, value: string, detail?: string): string {
  return createHash("sha1").update(`${key}|${value}|${detail ?? ""}`).digest("hex").slice(0, 16);
}
function mk(s: Omit<Stat, "signature">): Stat {
  return { ...s, signature: sig(s.key, s.value, s.detail) };
}

interface FM {
  id: number; round: string; matchday: number | null; date: string;
  homeId: string; awayId: string; homeName: string; awayName: string;
  hg: number; ag: number; total: number; margin: number;
  winnerId: string | null; loserId: string | null; wasShootout: boolean;
}

function monthDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return isNaN(d.getTime()) ? isoDate : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export async function computeStats(matches: RawMatch[], sql: Sql): Promise<Stat[]> {
  // ── Normalise finished matches with mapped team ids + goals ──────────────────
  const fms: FM[] = [];
  for (const m of matches) {
    if (m.status !== "FINISHED" || m.hasResult === false) continue;
    if (m.homeGoals == null || m.awayGoals == null) continue;
    const homeId = apiNameToTeamId(m.homeTeamName);
    const awayId = apiNameToTeamId(m.awayTeamName);
    if (!homeId || !awayId) continue;
    const winnerId = m.winnerName ? apiNameToTeamId(m.winnerName) : null;
    const loserId = winnerId ? (winnerId === homeId ? awayId : homeId) : null;
    fms.push({
      id: m.id, round: m.round, matchday: m.matchday, date: (m.utcDate ?? "").slice(0, 10),
      homeId, awayId, homeName: TEAM_BY_ID.get(homeId)?.name ?? m.homeTeamName,
      awayName: TEAM_BY_ID.get(awayId)?.name ?? m.awayTeamName,
      hg: m.homeGoals, ag: m.awayGoals, total: m.homeGoals + m.awayGoals,
      margin: Math.abs(m.homeGoals - m.awayGoals),
      winnerId, loserId, wasShootout: m.wasShootout,
    });
  }

  const stats: Stat[] = [];
  if (fms.length === 0) return stats; // nothing played yet

  const scoreline = (m: FM) => `${m.homeName} ${m.hg}–${m.ag} ${m.awayName}`;
  const winnerName = (m: FM) => (m.hg > m.ag ? m.homeName : m.awayName);
  const loserName = (m: FM) => (m.hg > m.ag ? m.awayName : m.homeName);

  // ── Tournament: goals overview ───────────────────────────────────────────────
  const totalGoals = fms.reduce((s, m) => s + m.total, 0);
  const avg = totalGoals / fms.length;
  stats.push(mk({
    key: "goals_overview", category: "tournament", emoji: "⚽",
    title: "Goals So Far",
    value: `${totalGoals} goals in ${fms.length} ${fms.length === 1 ? "match" : "matches"}`,
    detail: `${avg.toFixed(2)} per game`,
    explanation: `${totalGoals} goals have been scored across the ${fms.length} ${fms.length === 1 ? "match" : "matches"} completed so far, an average of ${avg.toFixed(2)} per game. This counts goals from open play and regulation time only.`,
  }));

  // ── Highest-scoring match vs biggest blowout ─────────────────────────────────
  // Both pick the single TRUE record. When the same match is both (e.g. a 7–1),
  // collapse into one combined card rather than inventing a lesser second one.
  const hi = [...fms].sort((a, b) => b.total - a.total || b.margin - a.margin)[0];
  const blow = [...fms].sort((a, b) => b.margin - a.margin || b.total - a.total)[0];

  if (hi.id === blow.id && hi.total > 0) {
    const m = hi;
    stats.push(mk({
      key: "goal_fest", category: "tournament", emoji: "🔥",
      title: "Goal Fest",
      value: scoreline(m),
      detail: `${m.total} goals · ${m.margin}-goal margin · ${roundLabel(m.round)}`,
      teamIds: [m.homeId, m.awayId],
      explanation: `${scoreline(m)} in the ${roundLabel(m.round)} is the standout result so far — both the most goals in a single match (${m.total}) and the widest winning margin (${m.margin}). ${winnerName(m)} ran riot against ${loserName(m)}.`,
    }));
  } else {
    if (hi.total > 0) {
      stats.push(mk({
        key: "goal_fest", category: "tournament", emoji: "🔥",
        title: "Goal Fest",
        value: scoreline(hi),
        detail: `${hi.total} goals · ${roundLabel(hi.round)}`,
        teamIds: [hi.homeId, hi.awayId],
        explanation: `The most goals in a single match so far: ${scoreline(hi)} in the ${roundLabel(hi.round)}, ${hi.total} goals combined.`,
      }));
    }
    if (blow.margin >= 2) {
      stats.push(mk({
        key: "biggest_blowout", category: "tournament", emoji: "💪",
        title: "Biggest Blowout",
        value: scoreline(blow),
        detail: `${blow.margin}-goal margin · ${roundLabel(blow.round)}`,
        teamIds: [blow.homeId, blow.awayId],
        explanation: `The widest winning margin so far: ${winnerName(blow)} beat ${loserName(blow)} by ${blow.margin} goals (${scoreline(blow)}) in the ${roundLabel(blow.round)}.`,
      }));
    }
  }

  // ── Biggest upset (weaker seed beats stronger) ───────────────────────────────
  let upset: { fm: FM; ws: number; ls: number; gap: number } | null = null;
  for (const m of fms) {
    if (!m.winnerId || !m.loserId) continue;
    const ws = TEAM_BY_ID.get(m.winnerId)?.seed;
    const ls = TEAM_BY_ID.get(m.loserId)?.seed;
    if (ws == null || ls == null) continue;
    const gap = ws - ls; // positive ⇒ weaker (higher seed number) beat stronger
    if (gap > 0 && (!upset || gap > upset.gap)) upset = { fm: m, ws, ls, gap };
  }
  if (upset) {
    const wName = TEAM_BY_ID.get(upset.fm.winnerId!)?.name ?? upset.fm.winnerId;
    const lName = TEAM_BY_ID.get(upset.fm.loserId!)?.name ?? upset.fm.loserId;
    stats.push(mk({
      key: "biggest_upset", category: "tournament", emoji: "😱",
      title: "Biggest Upset",
      value: `${wName} (seed ${upset.ws}) beat ${lName} (seed ${upset.ls})`,
      detail: `${upset.gap} seeds apart · ${roundLabel(upset.fm.round)}`,
      teamIds: [upset.fm.winnerId!, upset.fm.loserId!],
      explanation: `Teams are seeded 1 (strongest) to 48 (weakest). ${wName} were seeded ${upset.ws} and ${lName} ${upset.ls} — a ${upset.gap}-seed gap, the biggest upset by seeding so far, in the ${roundLabel(upset.fm.round)}.`,
    }));
  }

  // ── Penalty shootouts ────────────────────────────────────────────────────────
  const shootouts = fms.filter((m) => m.wasShootout).length;
  if (shootouts > 0) {
    stats.push(mk({
      key: "shootouts", category: "tournament", emoji: "🎯",
      title: "Penalty Drama",
      value: `${shootouts} ${shootouts === 1 ? "match" : "matches"} decided on penalties`,
      explanation: `${shootouts} knockout ${shootouts === 1 ? "match has" : "matches have"} finished level and been settled from the penalty spot so far.`,
    }));
  }

  // ── Sharpest shooters (most goals scored) ────────────────────────────────────
  const scored = new Map<string, number>();
  for (const m of fms) {
    scored.set(m.homeId, (scored.get(m.homeId) ?? 0) + m.hg);
    scored.set(m.awayId, (scored.get(m.awayId) ?? 0) + m.ag);
  }
  const topScorer = [...scored.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topScorer && topScorer[1] > 0) {
    const tName = TEAM_BY_ID.get(topScorer[0])?.name ?? topScorer[0];
    stats.push(mk({
      key: "top_scoring_team", category: "tournament", emoji: "🚀",
      title: "Sharpest Shooters",
      value: `${tName} — ${topScorer[1]} goals`,
      teamIds: [topScorer[0]],
      explanation: `${tName} have found the net ${topScorer[1]} times so far — more than any other team in the tournament.`,
    }));
  }

  // ── DB-backed bits: standings, picks, users, points history ──────────────────
  const [standRows, pickRows, userRows, phRows] = (await Promise.all([
    sql`SELECT stage, slot, team_id FROM results WHERE stage IN ('group','runner','third','fourth')`,
    sql`SELECT user_id, stage, slot, team_id FROM picks`,
    sql`SELECT id, name FROM users`,
    sql`SELECT user_id, game_index, total FROM points_history`,
  ])) as [
    { stage: string; slot: string; team_id: string }[],
    { user_id: number; stage: string; slot: string; team_id: string }[],
    { id: number; name: string }[],
    { user_id: number; game_index: number; total: number }[],
  ];

  const N = userRows.length;
  const nameById = new Map(userRows.map((u) => [u.id, u.name]));

  // standings[group][stage] = team_id
  const standings = new Map<string, Record<string, string>>();
  for (const r of standRows) {
    if (!standings.has(r.slot)) standings.set(r.slot, {});
    standings.get(r.slot)![r.stage] = r.team_id;
  }

  // ── Cinderella: lowest-seeded team currently top-2 of its group ──────────────
  let cinderella: { teamId: string; group: string; pos: string; seed: number } | null = null;
  for (const [group, slots] of standings) {
    for (const [stage, pos] of [["group", "1st"], ["runner", "2nd"]] as const) {
      const teamId = slots[stage];
      const seed = teamId ? TEAM_BY_ID.get(teamId)?.seed : undefined;
      if (teamId && seed != null && (!cinderella || seed > cinderella.seed)) {
        cinderella = { teamId, group, pos, seed };
      }
    }
  }
  if (cinderella && cinderella.seed >= 25) {
    const cName = TEAM_BY_ID.get(cinderella.teamId)?.name ?? cinderella.teamId;
    stats.push(mk({
      key: "cinderella", category: "tournament", emoji: "🌟",
      title: "Cinderella Story",
      value: `${cName} (seed ${cinderella.seed}) sits ${cinderella.pos} in Group ${cinderella.group}`,
      detail: "One of the weakest seeds, punching above their weight",
      teamIds: [cinderella.teamId],
      explanation: `Seeds run 1–48; ${cName} were seeded ${cinderella.seed}, among the weakest in the field. Yet they currently sit ${cinderella.pos} in Group ${cinderella.group} and would advance if the group ended today.`,
    }));
  }

  // ── Pool: "Nobody saw it coming" ─────────────────────────────────────────────
  // For each currently-advancing team, how many players picked it to advance
  // (group or runner slot for its group)? Surface the least-backed one.
  if (N > 0 && standings.size > 0) {
    const advanceBackers = (group: string, teamId: string) => {
      const backers = new Set<number>();
      for (const p of pickRows) {
        if ((p.stage === "group" || p.stage === "runner") && p.slot === group && p.team_id === teamId) {
          backers.add(p.user_id);
        }
      }
      return backers.size;
    };
    let least: { teamId: string; group: string; pos: string; count: number; seed: number } | null = null;
    for (const [group, slots] of standings) {
      for (const [stage, pos] of [["group", "1st"], ["runner", "2nd"]] as const) {
        const teamId = slots[stage];
        if (!teamId) continue;
        const count = advanceBackers(group, teamId);
        const seed = TEAM_BY_ID.get(teamId)?.seed ?? 99;
        // Prefer fewest backers; break ties toward the weaker seed (more surprising).
        if (!least || count < least.count || (count === least.count && seed > least.seed)) {
          least = { teamId, group, pos, count, seed };
        }
      }
    }
    if (least && least.count <= Math.max(1, Math.floor(N / 3))) {
      const name = TEAM_BY_ID.get(least.teamId)?.name ?? least.teamId;
      stats.push(mk({
        key: "nobody_saw_it", category: "pool", emoji: "👀",
        title: "Nobody Saw It Coming",
        value: least.count === 0
          ? `Nobody picked ${name} to advance — they're ${least.pos} in Group ${least.group}`
          : `Only ${least.count} of ${N} picked ${name} to advance — ${least.pos} in Group ${least.group}`,
        teamIds: [least.teamId],
        explanation: `When picks locked, ${least.count === 0 ? "not a single player" : `only ${least.count} of the ${N} players`} had ${name} finishing in the top two of Group ${least.group}. They currently sit ${least.pos} — quietly defying the whole pool.`,
      }));
    }
  }

  // ── Pool: most-popular champion pick ─────────────────────────────────────────
  if (N > 0) {
    const champ = new Map<string, number>();
    for (const p of pickRows) if (p.stage === "champion" && p.slot === "pick") champ.set(p.team_id, (champ.get(p.team_id) ?? 0) + 1);
    const top = [...champ.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const pct = Math.round((top[1] / N) * 100);
      const cName = TEAM_BY_ID.get(top[0])?.name ?? top[0];
      stats.push(mk({
        key: "pool_favorite", category: "pool", emoji: "🏆",
        title: "Pool Favorite",
        value: `${cName} to win it all`,
        detail: `Picked by ${top[1]} of ${N} (${pct}%)`,
        teamIds: [top[0]],
        explanation: `${cName} is the pool's most-backed champion: ${top[1]} of the ${N} players (${pct}%) tipped them to lift the trophy.`,
      }));
    }
  }

  // ── Pool: the group everyone's getting most wrong ────────────────────────────
  if (N > 0 && standings.size > 0) {
    const positions = ["group", "runner", "third", "fourth"] as const;
    let worst: { group: string; pct: number } | null = null;
    for (const [group, slots] of standings) {
      const actuals = positions.map((s) => slots[s]).filter(Boolean) as string[];
      if (actuals.length < 4) continue; // only fully-ranked groups
      let correct = 0;
      for (const u of userRows) {
        for (const stage of positions) {
          const pick = pickRows.find((p) => p.user_id === u.id && p.stage === stage && p.slot === group);
          if (pick && pick.team_id === slots[stage]) correct++;
        }
      }
      const pct = Math.round((correct / (positions.length * N)) * 100);
      if (!worst || pct < worst.pct) worst = { group, pct };
    }
    if (worst) {
      stats.push(mk({
        key: "chaos_group", category: "pool", emoji: "🤯",
        title: "Chaos Group",
        value: `Group ${worst.group} is breaking brackets`,
        detail: `Only ${worst.pct}% of the pool's position picks match the current table`,
        explanation: `Comparing every player's four finishing-position picks for Group ${worst.group} against the current table, only ${worst.pct}% match — the lowest of any group. The standings have scrambled the pool's predictions here more than anywhere else.`,
      }));
    }
  }

  // ── Pool: biggest riser (rank climb across the points history) ───────────────
  if (phRows.length > 0) {
    const indices = [...new Set(phRows.map((r) => r.game_index))].sort((a, b) => a - b);
    if (indices.length >= 2) {
      const rankAt = (idx: number) => {
        const rows = phRows.filter((r) => r.game_index === idx).sort((a, b) => b.total - a.total);
        const m = new Map<number, number>();
        rows.forEach((r, i) => m.set(r.user_id, i + 1));
        return m;
      };
      const first = rankAt(indices[0]);
      const last = rankAt(indices[indices.length - 1]);
      let best: { userId: number; from: number; to: number; gain: number } | null = null;
      for (const [userId, toRank] of last) {
        const fromRank = first.get(userId);
        if (fromRank == null) continue;
        const gain = fromRank - toRank; // positive ⇒ climbed
        if (gain > 0 && (!best || gain > best.gain)) best = { userId, from: fromRank, to: toRank, gain };
      }
      if (best) {
        const pName = nameById.get(best.userId) ?? "Someone";
        stats.push(mk({
          key: "biggest_riser", category: "pool", emoji: "📈",
          title: "On The Rise",
          value: `${pName} climbed ${best.gain} ${best.gain === 1 ? "spot" : "spots"}`,
          detail: `From ${ordinal(best.from)} to ${ordinal(best.to)} on the leaderboard`,
          explanation: `Tracking each player's leaderboard rank game-by-game, ${pName} has surged the most — climbing ${best.gain} ${best.gain === 1 ? "spot" : "spots"}, from ${ordinal(best.from)} to ${ordinal(best.to)}.`,
        }));
      }
    }
  }

  // ── More tournament records ──────────────────────────────────────────────────

  // Goal Rush — the single calendar day with the most goals.
  {
    const byDay = new Map<string, { goals: number; matches: number }>();
    for (const m of fms) {
      if (!m.date) continue;
      const d = byDay.get(m.date) ?? { goals: 0, matches: 0 };
      d.goals += m.total; d.matches += 1;
      byDay.set(m.date, d);
    }
    const top = [...byDay.entries()].sort((a, b) => b[1].goals - a[1].goals)[0];
    if (top && top[1].goals > 0) {
      const label = monthDay(top[0]);
      stats.push(mk({
        key: "goal_rush", category: "tournament", emoji: "📅",
        title: "Goal Rush",
        value: `${top[1].goals} goals on ${label}`,
        detail: `across ${top[1].matches} ${top[1].matches === 1 ? "match" : "matches"}`,
        explanation: `${label} has been the busiest day of the tournament so far — ${top[1].goals} goals across ${top[1].matches} ${top[1].matches === 1 ? "match" : "matches"}.`,
      }));
    }
  }

  // Brick Wall — fewest goals conceded (favouring teams that have played more).
  {
    const conceded = new Map<string, number>();
    const games = new Map<string, number>();
    for (const m of fms) {
      conceded.set(m.homeId, (conceded.get(m.homeId) ?? 0) + m.ag);
      conceded.set(m.awayId, (conceded.get(m.awayId) ?? 0) + m.hg);
      games.set(m.homeId, (games.get(m.homeId) ?? 0) + 1);
      games.set(m.awayId, (games.get(m.awayId) ?? 0) + 1);
    }
    const best = [...conceded.entries()].sort((a, b) => a[1] - b[1] || (games.get(b[0]) ?? 0) - (games.get(a[0]) ?? 0))[0];
    if (best && (games.get(best[0]) ?? 0) >= 2) {
      const tName = TEAM_BY_ID.get(best[0])?.name ?? best[0];
      const g = games.get(best[0]) ?? 0;
      stats.push(mk({
        key: "brick_wall", category: "tournament", emoji: "🧱",
        title: "Brick Wall",
        value: `${tName} — ${best[1]} conceded`,
        detail: `in ${g} matches`,
        teamIds: [best[0]],
        explanation: `${tName} have the meanest defense so far, conceding just ${best[1]} ${best[1] === 1 ? "goal" : "goals"} across ${g} matches.`,
      }));
    }
  }

  // Group of Goals — the group whose matches have produced the most goals.
  {
    const groupGoals = new Map<string, { goals: number; matches: number }>();
    for (const m of fms) {
      if (m.round !== "group stage") continue;
      const grp = TEAM_BY_ID.get(m.homeId)?.group;
      if (!grp) continue;
      const g = groupGoals.get(grp) ?? { goals: 0, matches: 0 };
      g.goals += m.total; g.matches += 1;
      groupGoals.set(grp, g);
    }
    const top = [...groupGoals.entries()].sort((a, b) => b[1].goals - a[1].goals)[0];
    if (top && top[1].goals > 0) {
      stats.push(mk({
        key: "goal_heavy_group", category: "tournament", emoji: "⚔️",
        title: "Group of Goals",
        value: `Group ${top[0]} — ${top[1].goals} goals`,
        detail: `in ${top[1].matches} ${top[1].matches === 1 ? "match" : "matches"} so far`,
        explanation: `Group ${top[0]} has been the most entertaining pool so far, producing ${top[1].goals} goals across its ${top[1].matches} ${top[1].matches === 1 ? "match" : "matches"}.`,
      }));
    }
  }

  // Favorite Flop — a pre-tournament heavyweight currently in the bottom two.
  {
    let flop: { teamId: string; group: string; pos: string; seed: number } | null = null;
    for (const [group, slots] of standings) {
      for (const [stage, pos] of [["third", "3rd"], ["fourth", "4th"]] as const) {
        const teamId = slots[stage];
        const seed = teamId ? TEAM_BY_ID.get(teamId)?.seed : undefined;
        if (teamId && seed != null && (!flop || seed < flop.seed)) flop = { teamId, group, pos, seed };
      }
    }
    if (flop && flop.seed <= 12) {
      const tName = TEAM_BY_ID.get(flop.teamId)?.name ?? flop.teamId;
      stats.push(mk({
        key: "favorite_flop", category: "tournament", emoji: "😬",
        title: "Favorite Flop",
        value: `${tName} (seed ${flop.seed}) sits ${flop.pos} in Group ${flop.group}`,
        detail: "A pre-tournament favorite in danger of going out",
        teamIds: [flop.teamId],
        explanation: `${tName} were one of the strongest seeds in the field (seed ${flop.seed}), but they currently sit ${flop.pos} in Group ${flop.group} — outside the qualification places and at risk of an early exit.`,
      }));
    }
  }

  // ── More pool stats ──────────────────────────────────────────────────────────

  // Sharpest Forecaster — most exact group finishing positions called correctly.
  if (N > 0 && standings.size > 0) {
    const positions = ["group", "runner", "third", "fourth"] as const;
    let totalActuals = 0;
    for (const [, slots] of standings) for (const s of positions) if (slots[s]) totalActuals++;
    let best: { userId: number; correct: number } | null = null;
    for (const u of userRows) {
      let correct = 0;
      for (const [group, slots] of standings) {
        for (const stage of positions) {
          if (!slots[stage]) continue;
          const pick = pickRows.find((p) => p.user_id === u.id && p.stage === stage && p.slot === group);
          if (pick && pick.team_id === slots[stage]) correct++;
        }
      }
      if (!best || correct > best.correct) best = { userId: u.id, correct };
    }
    if (best && best.correct > 0) {
      const pName = nameById.get(best.userId) ?? "Someone";
      stats.push(mk({
        key: "sharpest_forecaster", category: "pool", emoji: "🔮",
        title: "Sharpest Forecaster",
        value: `${pName} has nailed ${best.correct} group finishes`,
        detail: `${best.correct} of ${totalActuals} positions exactly right so far`,
        explanation: `Across every group's finishing positions decided so far, ${pName} has the sharpest crystal ball — ${best.correct} of ${totalActuals} exact positions called correctly.`,
      }));
    }
  }

  // Free Fall — the player who has dropped the most leaderboard spots.
  if (phRows.length > 0) {
    const indices = [...new Set(phRows.map((r) => r.game_index))].sort((a, b) => a - b);
    if (indices.length >= 2) {
      const rankAt = (idx: number) => {
        const rows = phRows.filter((r) => r.game_index === idx).sort((a, b) => b.total - a.total);
        const m = new Map<number, number>();
        rows.forEach((r, i) => m.set(r.user_id, i + 1));
        return m;
      };
      const first = rankAt(indices[0]);
      const last = rankAt(indices[indices.length - 1]);
      let worst: { userId: number; from: number; to: number; drop: number } | null = null;
      for (const [userId, toRank] of last) {
        const fromRank = first.get(userId);
        if (fromRank == null) continue;
        const drop = toRank - fromRank; // positive ⇒ fell
        if (drop > 0 && (!worst || drop > worst.drop)) worst = { userId, from: fromRank, to: toRank, drop };
      }
      if (worst) {
        const pName = nameById.get(worst.userId) ?? "Someone";
        stats.push(mk({
          key: "free_fall", category: "pool", emoji: "📉",
          title: "Free Fall",
          value: `${pName} slid ${worst.drop} ${worst.drop === 1 ? "spot" : "spots"}`,
          detail: `From ${ordinal(worst.from)} to ${ordinal(worst.to)} on the leaderboard`,
          explanation: `Not everyone's trending up: ${pName} has tumbled the furthest, dropping ${worst.drop} ${worst.drop === 1 ? "spot" : "spots"} from ${ordinal(worst.from)} to ${ordinal(worst.to)}.`,
        }));
      }
    }
  }

  // Down To The Wire — the gap at the very top of the leaderboard right now.
  if (phRows.length > 0 && N >= 2) {
    const lastIdx = Math.max(...phRows.map((r) => r.game_index));
    const totals = phRows.filter((r) => r.game_index === lastIdx).sort((a, b) => b.total - a.total);
    if (totals.length >= 2) {
      const gap = totals[0].total - totals[1].total;
      const leader = nameById.get(totals[0].user_id) ?? "Someone";
      const second = nameById.get(totals[1].user_id) ?? "Someone";
      stats.push(mk({
        key: "tightest_race", category: "pool", emoji: "🏁",
        title: "Down To The Wire",
        value: gap === 0 ? `${leader} & ${second} are dead level on top` : `Just ${gap} ${gap === 1 ? "point" : "points"} between 1st and 2nd`,
        detail: gap === 0 ? "Tied for the lead" : `${leader} leads ${second}`,
        explanation: gap === 0
          ? `It could not be tighter at the top: ${leader} and ${second} are tied on points, sharing the lead.`
          : `The race for first is on a knife edge — ${leader} leads ${second} by just ${gap} ${gap === 1 ? "point" : "points"}.`,
      }));
    }
  }

  // Great Minds — the pair of players whose brackets overlap the most.
  if (userRows.length >= 2) {
    const slotsByUser = new Map<number, Map<string, string>>();
    for (const u of userRows) slotsByUser.set(u.id, new Map());
    for (const p of pickRows) slotsByUser.get(p.user_id)?.set(`${p.stage}:${p.slot}`, p.team_id);
    let best: { a: number; b: number; matches: number; common: number } | null = null;
    for (let i = 0; i < userRows.length; i++) {
      for (let j = i + 1; j < userRows.length; j++) {
        const A = slotsByUser.get(userRows[i].id)!;
        const B = slotsByUser.get(userRows[j].id)!;
        let matches = 0, common = 0;
        for (const [k, v] of A) if (B.has(k)) { common++; if (B.get(k) === v) matches++; }
        if (common >= 12 && (!best || matches > best.matches)) best = { a: userRows[i].id, b: userRows[j].id, matches, common };
      }
    }
    if (best && best.matches > 0) {
      const aN = nameById.get(best.a) ?? "Someone";
      const bN = nameById.get(best.b) ?? "Someone";
      const pct = Math.round((best.matches / best.common) * 100);
      stats.push(mk({
        key: "great_minds", category: "pool", emoji: "👯",
        title: "Great Minds",
        value: `${aN} & ${bN} agree on ${best.matches} of ${best.common} picks`,
        detail: `${pct}% identical brackets`,
        explanation: `${aN} and ${bN} think alike — their brackets match on ${best.matches} of ${best.common} shared picks (${pct}%), the most of any pair in the pool.`,
      }));
    }
  }

  // Bandwagon Bust — the most-backed team that's currently NOT advancing.
  if (N > 0 && standings.size > 0) {
    const backers = (group: string, teamId: string) => {
      const set = new Set<number>();
      for (const p of pickRows) if ((p.stage === "group" || p.stage === "runner") && p.slot === group && p.team_id === teamId) set.add(p.user_id);
      return set.size;
    };
    let bust: { teamId: string; group: string; pos: string; count: number } | null = null;
    for (const [group, slots] of standings) {
      for (const [stage, pos] of [["third", "3rd"], ["fourth", "4th"]] as const) {
        const teamId = slots[stage];
        if (!teamId) continue;
        const count = backers(group, teamId);
        if (count > 0 && (!bust || count > bust.count)) bust = { teamId, group, pos, count };
      }
    }
    if (bust && bust.count >= Math.max(2, Math.ceil(N / 3))) {
      const tName = TEAM_BY_ID.get(bust.teamId)?.name ?? bust.teamId;
      stats.push(mk({
        key: "bandwagon_bust", category: "pool", emoji: "🐂",
        title: "Bandwagon Bust",
        value: `${bust.count} of ${N} backed ${tName} to advance — they're ${bust.pos}`,
        teamIds: [bust.teamId],
        explanation: `The pool piled onto ${tName}: ${bust.count} of ${N} players had them advancing from Group ${bust.group}. Right now they sit ${bust.pos} — on the wrong side of the line.`,
      }));
    }
  }

  return stats;
}

// Compute and persist the single stats_snapshot row. Idempotent.
export async function rebuildStats(matches: RawMatch[], sql: Sql): Promise<{ count: number }> {
  const stats = await computeStats(matches, sql);
  await sql`
    INSERT INTO stats_snapshot (id, data, computed_at)
    VALUES (1, ${JSON.stringify(stats)}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, computed_at = NOW()
  `;
  return { count: stats.length };
}
