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
