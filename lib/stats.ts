// Stats / fun-facts engine. Builds the Stat Sheet from two sources:
//   • Tournament ("World Cup" tab) — curated "interesting facts about World Cup
//     2026" from lib/wc-facts.ts, a couple of which fold in live goal/match counts.
//   • Pool ("Johnsies" tab) — facts about our players' picks vs reality, derived
//     for FREE from the picks / standings / points-history tables.
// Rebuilt by the results cron when results change; materialised into the single
// stats_snapshot row.

import { createHash } from "crypto";
import { getSql } from "@/lib/db";
import { type RawMatch } from "@/lib/api-football";
import { apiNameToTeamId } from "@/lib/team-mapping";
import { TEAMS } from "@/lib/data";
import { buildWcFacts } from "@/lib/wc-facts";

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

  // ── Tournament tab: curated "interesting facts about World Cup 2026" ──────────
  // Hand-curated evergreen facts (format, hosts, debutants, milestones) plus a
  // couple that fold in live numbers from the matches we already have on hand.
  // See lib/wc-facts.ts. Wrapped through mk() so they share the snapshot / flavor
  // (LLM headline) / archive pipeline with the pool facts below.
  const totalGoals = fms.reduce((s, m) => s + m.total, 0);
  stats.push(...buildWcFacts({ matchesPlayed: fms.length, totalGoals }).map(mk));

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

// Compute and persist the live stats_snapshot row plus today's archive row.
// Idempotent — today's archive row keeps refreshing until midnight (UTC), so it
// ends up holding the day's final state. Past days accrue one row each.
export async function rebuildStats(matches: RawMatch[], sql: Sql): Promise<{ count: number }> {
  const stats = await computeStats(matches, sql);
  const json = JSON.stringify(stats);
  await sql`
    INSERT INTO stats_snapshot (id, data, computed_at)
    VALUES (1, ${json}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, computed_at = NOW()
  `;
  await sql`
    INSERT INTO stats_archive (snapshot_date, data, computed_at)
    VALUES (CURRENT_DATE, ${json}::jsonb, NOW())
    ON CONFLICT (snapshot_date) DO UPDATE SET data = EXCLUDED.data, computed_at = NOW()
  `;
  return { count: stats.length };
}
