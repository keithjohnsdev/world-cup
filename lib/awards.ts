// Award calculation engine.
// Call computeAwards() with all data loaded from the DB.
// Each award returns { name, userId, userName, reason } or null if not yet determinable.

import { TEAMS } from "@/lib/data";
import { resolveR32 } from "@/lib/bracket";
import type { UserRow, PickRow, ResultRow, ScoreBreakdown } from "@/lib/scoring";
import type { SnapshotRow } from "@/lib/snapshots";

export interface AwardResult {
  name: string;
  userId: number | null;
  userName: string;
  reason: string;
}

interface AwardInput {
  users: UserRow[];
  picksByUser: Map<number, PickRow[]>;
  results: ResultRow[];
  breakdowns: ScoreBreakdown[];
  snapshots: SnapshotRow[];
  // Winner-group → third-group assignment for the official R32 (from lib/thirds.ts).
  thirdAssign?: Record<string, string> | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resultMap(results: ResultRow[]): Map<string, ResultRow> {
  const m = new Map<string, ResultRow>();
  for (const r of results) m.set(`${r.stage}:${r.slot}`, r);
  return m;
}

// Build a map of every knockout match slot → [team1, team2] from results.
function buildMatchPairs(
  rm: Map<string, ResultRow>,
  thirdAssign: Record<string, string> | null | undefined,
): Map<string, [string, string]> {
  const pairs = new Map<string, [string, string]>();

  // R32 — official structure: winners/runners from standings, thirds via Annex C.
  const teamMap = new Map<string, string>();
  for (const [k, r] of rm) teamMap.set(k, r.team_id);
  for (const m of resolveR32(teamMap, thirdAssign)) {
    if (m.team1 && m.team2) pairs.set(`r32:${m.slot}`, [m.team1, m.team2]);
  }

  // R16 — winners of r32 match pairs
  for (let i = 0; i < 8; i++) {
    const t1 = rm.get(`r32:m${2 * i + 1}`)?.team_id;
    const t2 = rm.get(`r32:m${2 * i + 2}`)?.team_id;
    if (t1 && t2) pairs.set(`r16:m${i + 1}`, [t1, t2]);
  }

  // QF
  for (let i = 0; i < 4; i++) {
    const t1 = rm.get(`r16:m${2 * i + 1}`)?.team_id;
    const t2 = rm.get(`r16:m${2 * i + 2}`)?.team_id;
    if (t1 && t2) pairs.set(`qf:m${i + 1}`, [t1, t2]);
  }

  // SF
  for (let i = 0; i < 2; i++) {
    const t1 = rm.get(`qf:m${2 * i + 1}`)?.team_id;
    const t2 = rm.get(`qf:m${2 * i + 2}`)?.team_id;
    if (t1 && t2) pairs.set(`sf:m${i + 1}`, [t1, t2]);
  }

  // Final
  const ft1 = rm.get("sf:m1")?.team_id;
  const ft2 = rm.get("sf:m2")?.team_id;
  if (ft1 && ft2) pairs.set("final:m1", [ft1, ft2]);

  return pairs;
}

const KNOCKOUT_STAGES = new Set(["r32", "r16", "qf", "sf", "final"]);
const STAGE_ORDER = ["r32", "r16", "qf", "sf", "final"];

function pickWinner(
  candidates: { userId: number; userName: string; score: number }[],
  tieReason = ""
): { userId: number; userName: string } {
  // Sort desc by score, break ties alphabetically
  candidates.sort(
    (a, b) => b.score - a.score || a.userName.localeCompare(b.userName)
  );
  return candidates[0] ?? { userId: 0, userName: "Nobody" };
}

// ── Award functions ────────────────────────────────────────────────────────────

function theChampion({ breakdowns }: AwardInput): AwardResult {
  const best = [...breakdowns].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name)
  )[0];
  return {
    name: "The Champion",
    userId: best?.userId ?? null,
    userName: best?.name ?? "TBD",
    reason: best ? `${best.total} total points` : "Tournament not complete",
  };
}

function woodenSpoon({ breakdowns }: AwardInput): AwardResult {
  const worst = [...breakdowns].sort(
    (a, b) => a.total - b.total || a.name.localeCompare(b.name)
  )[0];
  return {
    name: "Wooden Spoon",
    userId: worst?.userId ?? null,
    userName: worst?.name ?? "TBD",
    reason: worst ? `${worst.total} total points — dead last` : "Tournament not complete",
  };
}

function trueBeliever({ users, picksByUser, results }: AwardInput): AwardResult {
  const rm = resultMap(results);
  const winner = rm.get("final:m1")?.team_id;
  if (!winner) {
    return { name: "True Believer", userId: null, userName: "TBD", reason: "Final not played yet" };
  }
  const believers = users.filter(
    (u) => picksByUser.get(u.id)?.find((p) => p.stage === "champion" && p.slot === "pick" && p.team_id === winner)
  );
  if (!believers.length) {
    return { name: "True Believer", userId: null, userName: "Nobody", reason: "No one picked the champion" };
  }
  const first = believers[0];
  return {
    name: "True Believer",
    userId: first.id,
    userName: first.name,
    reason: `Picked ${TEAMS.find((t) => t.id === winner)?.name ?? winner} as champion before the tournament`,
  };
}

function theCloser({ users, picksByUser, results }: AwardInput): AwardResult {
  const rm = resultMap(results);
  const lateStages = new Set(["qf", "sf", "final"]);
  const scores = users.map((u) => {
    const picks = picksByUser.get(u.id) ?? [];
    let pts = 0;
    const STAGE_PTS: Record<string, number> = { qf: 8, sf: 16, final: 32 };
    for (const p of picks) {
      if (!lateStages.has(p.stage)) continue;
      const result = rm.get(`${p.stage}:${p.slot}`);
      if (!result) continue;
      if (p.team_id === result.team_id) pts += STAGE_PTS[p.stage] ?? 0;
      else if (result.was_shootout) pts += (STAGE_PTS[p.stage] ?? 0) / 2;
    }
    return { userId: u.id, userName: u.name, score: pts };
  });
  const best = pickWinner(scores);
  const score = scores.find((s) => s.userId === best.userId)?.score ?? 0;
  return {
    name: "The Closer",
    userId: best.userId || null,
    userName: best.userName,
    reason: `${score} pts in QF + SF + Final`,
  };
}

function bracketBrainiac({ users, picksByUser, results }: AwardInput): AwardResult {
  const rm = resultMap(results);
  const scores = users.map((u) => {
    const picks = (picksByUser.get(u.id) ?? []).filter((p) => KNOCKOUT_STAGES.has(p.stage));
    const attempted = picks.filter((p) => rm.has(`${p.stage}:${p.slot}`));
    const correct = attempted.filter((p) => p.team_id === rm.get(`${p.stage}:${p.slot}`)?.team_id);
    const pct = attempted.length > 0 ? correct.length / attempted.length : 0;
    return { userId: u.id, userName: u.name, score: Math.round(pct * 10000) }; // ×10000 for integer sort
  });
  const best = pickWinner(scores);
  const raw = scores.find((s) => s.userId === best.userId)?.score ?? 0;
  return {
    name: "Bracket Brainiac",
    userId: best.userId || null,
    userName: best.userName,
    reason: `${(raw / 100).toFixed(1)}% knockout accuracy`,
  };
}

function thePacemaker({ users, snapshots }: AwardInput): AwardResult {
  if (!snapshots.length) {
    return { name: "The Pacemaker", userId: null, userName: "TBD", reason: "Standings snapshots not yet available" };
  }
  const leadCounts = new Map<number, number>();
  const rounds = ["pre_r32", "pre_r16", "pre_qf", "pre_sf", "pre_final"];
  for (const round of rounds) {
    const roundRows = snapshots.filter((s) => s.round === round);
    if (!roundRows.length) continue;
    const leader = roundRows.reduce((a, b) => (a.total_score >= b.total_score ? a : b));
    leadCounts.set(leader.user_id, (leadCounts.get(leader.user_id) ?? 0) + 1);
  }
  if (!leadCounts.size) {
    return { name: "The Pacemaker", userId: null, userName: "TBD", reason: "No snapshots yet" };
  }
  const [topId, topCount] = [...leadCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const user = users.find((u) => u.id === topId);
  return {
    name: "The Pacemaker",
    userId: topId,
    userName: user?.name ?? "Unknown",
    reason: `Led the standings for ${topCount} round${topCount !== 1 ? "s" : ""}`,
  };
}

function theHandOfGod({ users, picksByUser, results }: AwardInput): AwardResult {
  const rm = resultMap(results);
  const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"];
  const gods = users.filter((u) => {
    const picks = picksByUser.get(u.id) ?? [];
    return groups.every((g) => {
      const actual = rm.get(`group:${g}`)?.team_id;
      if (!actual) return false; // group not finished yet
      const pick = picks.find((p) => p.stage === "group" && p.slot === g);
      return pick?.team_id === actual;
    });
  });
  if (!gods.length) {
    return { name: "The Hand of God", userId: null, userName: "Nobody", reason: "No one correctly predicted all 12 group winners" };
  }
  return {
    name: "The Hand of God",
    userId: gods[0].id,
    userName: gods[0].name,
    reason: "Correctly predicted the 1st place team in all 12 groups",
  };
}

function heartbreakHotel({ users, picksByUser, results }: AwardInput): AwardResult {
  const rm = resultMap(results);
  const scores = users.map((u) => {
    const picks = (picksByUser.get(u.id) ?? []).filter((p) => KNOCKOUT_STAGES.has(p.stage));
    const heartbreaks = picks.filter((p) => {
      const r = rm.get(`${p.stage}:${p.slot}`);
      return r && r.was_shootout && p.team_id !== r.team_id;
    });
    return { userId: u.id, userName: u.name, score: heartbreaks.length };
  });
  const best = pickWinner(scores);
  const count = scores.find((s) => s.userId === best.userId)?.score ?? 0;
  if (!count) return { name: "Heartbreak Hotel", userId: null, userName: "Nobody", reason: "No penalty shootout losses yet" };
  return {
    name: "Heartbreak Hotel",
    userId: best.userId || null,
    userName: best.userName,
    reason: `${count} pick${count !== 1 ? "s" : ""} eliminated in penalty shootouts`,
  };
}

function humanCoinFlip({ users, picksByUser, results }: AwardInput): AwardResult {
  const rm = resultMap(results);
  const scores = users.map((u) => {
    const picks = (picksByUser.get(u.id) ?? []).filter((p) => KNOCKOUT_STAGES.has(p.stage));
    const attempted = picks.filter((p) => rm.has(`${p.stage}:${p.slot}`));
    const correct = attempted.filter((p) => p.team_id === rm.get(`${p.stage}:${p.slot}`)?.team_id);
    const pct = attempted.length > 0 ? correct.length / attempted.length : 0;
    return { userId: u.id, userName: u.name, pct, attempted: attempted.length };
  }).filter((s) => s.attempted > 0);

  if (!scores.length) return { name: "The Human Coin Flip", userId: null, userName: "TBD", reason: "No knockout results yet" };

  const closest = scores.sort(
    (a, b) => Math.abs(a.pct - 0.5) - Math.abs(b.pct - 0.5)
  )[0];
  return {
    name: "The Human Coin Flip",
    userId: closest.userId,
    userName: closest.userName,
    reason: `${(closest.pct * 100).toFixed(0)}% accuracy — perfectly, uselessly neutral`,
  };
}

function crossEyed({ users, picksByUser, results }: AwardInput): AwardResult {
  const rm = resultMap(results);
  const scores = users.map((u) => {
    const picks = picksByUser.get(u.id) ?? [];
    let count = 0;
    for (const g of ["A","B","C","D","E","F","G","H","I","J","K","L"]) {
      const advancers = new Set([
        rm.get(`group:${g}`)?.team_id,
        rm.get(`runner:${g}`)?.team_id,
      ].filter(Boolean));
      // Picked a team to finish top 2 but they finished in the wrong top-2 position
      const p1 = picks.find((p) => p.stage === "group" && p.slot === g);
      const p2 = picks.find((p) => p.stage === "runner" && p.slot === g);
      const a1 = rm.get(`group:${g}`)?.team_id;
      const a2 = rm.get(`runner:${g}`)?.team_id;
      if (p1 && advancers.has(p1.team_id) && p1.team_id !== a1) count++;
      if (p2 && advancers.has(p2.team_id) && p2.team_id !== a2) count++;
    }
    return { userId: u.id, userName: u.name, score: count };
  });
  const best = pickWinner(scores);
  const count = scores.find((s) => s.userId === best.userId)?.score ?? 0;
  if (!count) return { name: "Help, I've Gone Cross-Eyed", userId: null, userName: "Nobody", reason: "No cross-eyed picks yet" };
  return {
    name: "Help, I've Gone Cross-Eyed",
    userId: best.userId || null,
    userName: best.userName,
    reason: `${count} picks where the team advanced but finished in the wrong position`,
  };
}

function theTrendsetter({ users, picksByUser, results }: AwardInput): AwardResult {
  const rm = resultMap(results);
  // Count how many users made each (stage:slot, team_id) pick
  const pickCounts = new Map<string, number>();
  for (const [, picks] of picksByUser) {
    for (const p of picks) {
      if (!KNOCKOUT_STAGES.has(p.stage)) continue;
      const key = `${p.stage}:${p.slot}:${p.team_id}`;
      pickCounts.set(key, (pickCounts.get(key) ?? 0) + 1);
    }
  }
  const scores = users.map((u) => {
    const picks = (picksByUser.get(u.id) ?? []).filter((p) => KNOCKOUT_STAGES.has(p.stage) && rm.has(`${p.stage}:${p.slot}`));
    const unique = picks.filter((p) => {
      const key = `${p.stage}:${p.slot}:${p.team_id}`;
      return (pickCounts.get(key) ?? 0) === 1;
    });
    return { userId: u.id, userName: u.name, score: unique.length };
  });
  const best = pickWinner(scores);
  const count = scores.find((s) => s.userId === best.userId)?.score ?? 0;
  if (!count) return { name: "The Trendsetter", userId: null, userName: "Nobody", reason: "No unique picks recorded" };
  return {
    name: "The Trendsetter",
    userId: best.userId || null,
    userName: best.userName,
    reason: `${count} unique pick${count !== 1 ? "s" : ""} that nobody else made`,
  };
}

function reverseOracle({ users, picksByUser, results }: AwardInput): AwardResult {
  const rm = resultMap(results);
  const scores = users.map((u) => {
    const picks = (picksByUser.get(u.id) ?? []).filter((p) => KNOCKOUT_STAGES.has(p.stage));
    const incorrect = picks.filter((p) => {
      const r = rm.get(`${p.stage}:${p.slot}`);
      return r && p.team_id !== r.team_id;
    });
    return { userId: u.id, userName: u.name, score: incorrect.length };
  });
  const best = pickWinner(scores);
  const count = scores.find((s) => s.userId === best.userId)?.score ?? 0;
  if (!count) return { name: "Reverse Oracle", userId: null, userName: "Nobody", reason: "No results yet" };
  return {
    name: "Reverse Oracle",
    userId: best.userId || null,
    userName: best.userName,
    reason: `${count} incorrect knockout picks — so reliably wrong you're almost useful`,
  };
}

function earlyRetirement({ users, picksByUser, results }: AwardInput): AwardResult {
  const rm = resultMap(results);
  // A team was "eliminated in groups" if they don't appear as any group winner or runner-up
  const groupAdvancers = new Set<string>();
  for (const g of ["A","B","C","D","E","F","G","H","I","J","K","L"]) {
    const w = rm.get(`group:${g}`)?.team_id;
    const r = rm.get(`runner:${g}`)?.team_id;
    if (w) groupAdvancers.add(w);
    if (r) groupAdvancers.add(r);
  }
  const retirees = users.filter((u) => {
    const champPick = picksByUser.get(u.id)?.find((p) => p.stage === "champion" && p.slot === "pick");
    if (!champPick) return false;
    // Only flag if at least some groups are done (otherwise groupAdvancers is empty)
    if (!groupAdvancers.size) return false;
    return !groupAdvancers.has(champPick.team_id);
  });
  if (!retirees.length) return { name: "Early Retirement", userId: null, userName: "Nobody", reason: "No champion picks eliminated in group stage" };
  return {
    name: "Early Retirement",
    userId: retirees[0].id,
    userName: retirees[0].name,
    reason: `Champion pick ${TEAMS.find((t) => t.id === picksByUser.get(retirees[0].id)?.find((p) => p.stage === "champion")?.team_id)?.name ?? ""} was eliminated in the group stage`,
  };
}

function upsetArtist({ users, picksByUser, results, thirdAssign }: AwardInput): AwardResult {
  const rm = resultMap(results);
  const matchPairs = buildMatchPairs(rm, thirdAssign);
  const teamSeed = new Map(TEAMS.map((t) => [t.id, t.seed]));

  const scores = users.map((u) => {
    const picks = (picksByUser.get(u.id) ?? []).filter((p) => KNOCKOUT_STAGES.has(p.stage));
    let upsets = 0;
    for (const p of picks) {
      const r = rm.get(`${p.stage}:${p.slot}`);
      if (!r || p.team_id !== r.team_id) continue; // not correct
      const pair = matchPairs.get(`${p.stage}:${p.slot}`);
      if (!pair) continue;
      const [t1, t2] = pair;
      const loser = t1 === p.team_id ? t2 : t1;
      const winnerSeed = teamSeed.get(p.team_id) ?? 999;
      const loserSeed  = teamSeed.get(loser) ?? 999;
      if (winnerSeed > loserSeed) upsets++; // higher seed = weaker team = upset
    }
    return { userId: u.id, userName: u.name, score: upsets };
  });
  const best = pickWinner(scores);
  const count = scores.find((s) => s.userId === best.userId)?.score ?? 0;
  if (!count) return { name: "Upset Artist", userId: null, userName: "Nobody", reason: "No correct upset picks yet" };
  return {
    name: "Upset Artist",
    userId: best.userId || null,
    userName: best.userName,
    reason: `${count} correctly predicted upset${count !== 1 ? "s" : ""}`,
  };
}

function theHipster({ users, picksByUser, results, thirdAssign }: AwardInput): AwardResult {
  const rm = resultMap(results);
  const matchPairs = buildMatchPairs(rm, thirdAssign);
  const teamSeed = new Map(TEAMS.map((t) => [t.id, t.seed]));

  // For each user: what's the deepest round reached by the highest-seeded (weakest) team they correctly picked?
  // "Deepest" = latest stage in STAGE_ORDER; "highest seed" = largest seed number
  const scores = users.map((u) => {
    const picks = (picksByUser.get(u.id) ?? []).filter((p) => KNOCKOUT_STAGES.has(p.stage));
    let bestScore = 0; // seed * stageDepth
    let bestTeam = "";
    let bestStage = "";
    for (const p of picks) {
      const r = rm.get(`${p.stage}:${p.slot}`);
      if (!r || p.team_id !== r.team_id) continue;
      const pair = matchPairs.get(`${p.stage}:${p.slot}`);
      if (!pair) continue;
      const loser = pair[0] === p.team_id ? pair[1] : pair[0];
      const winnerSeed = teamSeed.get(p.team_id) ?? 1;
      const loserSeed  = teamSeed.get(loser) ?? 1;
      if (winnerSeed <= loserSeed) continue; // not an upset
      const depth = STAGE_ORDER.indexOf(p.stage) + 1;
      const score = winnerSeed * depth;
      if (score > bestScore) { bestScore = score; bestTeam = p.team_id; bestStage = p.stage; }
    }
    return { userId: u.id, userName: u.name, score: bestScore, team: bestTeam, stage: bestStage };
  });
  const best = scores.sort((a, b) => b.score - a.score)[0];
  if (!best?.score) return { name: "The Hipster", userId: null, userName: "Nobody", reason: "No hipster picks confirmed yet" };
  const teamName = TEAMS.find((t) => t.id === best.team)?.name ?? best.team;
  return {
    name: "The Hipster",
    userId: best.userId,
    userName: best.userName,
    reason: `Correctly backed ${teamName} (seed #${teamSeed.get(best.team)}) to win in the ${best.stage.toUpperCase()}`,
  };
}

function comebackKid({ users, breakdowns, snapshots }: AwardInput): AwardResult {
  if (!snapshots.length) return { name: "Comeback Kid", userId: null, userName: "TBD", reason: "Standings snapshots not yet available" };
  const preR32 = snapshots.filter((s) => s.round === "pre_r32");
  if (!preR32.length) return { name: "Comeback Kid", userId: null, userName: "TBD", reason: "Pre-R32 snapshot not yet available" };

  const totalUsers = preR32.length;
  const scores = users.map((u) => {
    const snap = preR32.find((s) => s.user_id === u.id);
    const startRank = snap?.rank ?? totalUsers;
    const finalBreakdown = breakdowns.find((b) => b.userId === u.id);
    const finalRank = breakdowns
      .sort((a, b) => b.total - a.total)
      .findIndex((b) => b.userId === u.id) + 1;
    return { userId: u.id, userName: u.name, score: startRank - finalRank }; // positive = improved
  });
  const best = pickWinner(scores);
  const improvement = scores.find((s) => s.userId === best.userId)?.score ?? 0;
  if (improvement <= 0) return { name: "Comeback Kid", userId: null, userName: "Nobody", reason: "No significant comebacks" };
  return {
    name: "Comeback Kid",
    userId: best.userId || null,
    userName: best.userName,
    reason: `Climbed ${improvement} place${improvement !== 1 ? "s" : ""} from pre-bracket standings to finish`,
  };
}

function closeButNoCigar({ users, picksByUser, results }: AwardInput): AwardResult {
  const rm = resultMap(results);
  const finalist = users.filter((u) => {
    const champPick = picksByUser.get(u.id)?.find((p) => p.stage === "champion" && p.slot === "pick");
    if (!champPick) return false;
    const finalWinner = rm.get("final:m1")?.team_id;
    if (!finalWinner) return false;
    // champion pick made the final but lost
    const inFinal =
      rm.get("sf:m1")?.team_id === champPick.team_id ||
      rm.get("sf:m2")?.team_id === champPick.team_id;
    return inFinal && champPick.team_id !== finalWinner;
  });
  if (!finalist.length) return { name: "Close But No Cigar", userId: null, userName: "Nobody", reason: "No champion picks made the Final (yet)" };
  return {
    name: "Close But No Cigar",
    userId: finalist[0].id,
    userName: finalist[0].name,
    reason: `Champion pick ${TEAMS.find((t) => t.id === picksByUser.get(finalist[0].id)?.find((p) => p.stage === "champion")?.team_id)?.name ?? ""} made the Final but lost`,
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function computeAwards(input: AwardInput): AwardResult[] {
  return [
    // Glory
    theChampion(input),
    trueBeliever(input),
    theCloser(input),
    theHipster(input),
    bracketBrainiac(input),
    thePacemaker(input),
    theHandOfGod(input),
    // Funny & Consolation
    woodenSpoon(input),
    heartbreakHotel(input),
    humanCoinFlip(input),
    crossEyed(input),
    theTrendsetter(input),
    reverseOracle(input),
    earlyRetirement(input),
    // Special
    upsetArtist(input),
    comebackKid(input),
    closeButNoCigar(input),
  ];
}
