import { getSql } from "@/lib/db";

// Scoped, time-boxed re-open of specific knockout stages while the rest of the
// bracket stays frozen. Used after the QF→SF pairing bug was fixed mid-tournament:
// every player's semifinalists (their qf picks) are correct, but the sf/final picks
// they made were on the wrong matchups, so those two rounds are re-opened for a
// fresh pick against the corrected semis — with a hard deadline at the first real
// semifinal's kickoff. Everything through the QF remains locked so decided rounds
// can't be edited with hindsight.
//
// Stored under the 'bracket_reopen' setting as { stages: string[], until: ISO }.
// Presence of the setting + now < until = the window is open. A companion
// 'bracket_reopen_fallback' setting holds, per user, the picks to restore at close
// for anyone who didn't re-pick — so nobody is left blank (see closeBracketReopenIfDue).

type Sql = ReturnType<typeof getSql>;

export interface BracketReopen {
  stages: string[];
  until: string; // ISO 8601 — window closes at this instant
}

export async function getBracketReopen(sql: Sql): Promise<BracketReopen | null> {
  const rows = (await sql`
    SELECT value FROM tournament_settings WHERE key = 'bracket_reopen' LIMIT 1
  `) as { value: string }[];
  if (!rows[0]) return null;
  try {
    const cfg = JSON.parse(rows[0].value) as Partial<BracketReopen>;
    if (!Array.isArray(cfg.stages) || typeof cfg.until !== "string") return null;
    return { stages: cfg.stages, until: cfg.until };
  } catch {
    return null;
  }
}

// Is the window open for this stage right now? (Setting present, stage listed, and
// the deadline not yet passed.) `now` is passed in so callers share one clock.
export function reopenAllowsStage(reopen: BracketReopen | null, stage: string, now: number): boolean {
  if (!reopen) return false;
  if (!reopen.stages.includes(stage)) return false;
  const until = Date.parse(reopen.until);
  return !isNaN(until) && now < until;
}

// Close the window once its deadline has passed: for every player who didn't make a
// pick in a re-opened slot, restore their migrated fallback (their original pick
// mapped onto the corrected bracket) so they're never left blank; then delete the
// 'bracket_reopen' setting so the window reads as closed. Idempotent — a no-op once
// the setting is gone or while the deadline is still in the future.
export async function closeBracketReopenIfDue(
  sql: Sql,
  now: number = Date.now(),
): Promise<{ closed: boolean; restored: number }> {
  const reopen = await getBracketReopen(sql);
  if (!reopen) return { closed: false, restored: 0 };
  const until = Date.parse(reopen.until);
  if (isNaN(until) || now < until) return { closed: false, restored: 0 };

  // Deadline passed — restore fallbacks for any still-missing picks.
  let restored = 0;
  const fbRows = (await sql`
    SELECT value FROM tournament_settings WHERE key = 'bracket_reopen_fallback' LIMIT 1
  `) as { value: string }[];
  if (fbRows[0]) {
    let fallback: Record<string, Record<string, string>> = {};
    try {
      fallback = JSON.parse(fbRows[0].value);
    } catch {
      fallback = {};
    }
    for (const [userId, slots] of Object.entries(fallback)) {
      const uid = Number(userId);
      if (!Number.isInteger(uid)) continue;
      for (const [stageSlot, teamId] of Object.entries(slots)) {
        const [stage, slot] = stageSlot.split(":");
        if (!stage || !slot || !teamId) continue;
        // ON CONFLICT DO NOTHING → only fills the slot when the player has no pick
        // there (i.e. they didn't re-pick it), never overwrites an actual re-pick.
        const res = (await sql`
          INSERT INTO picks (user_id, stage, slot, team_id)
          VALUES (${uid}, ${stage}, ${slot}, ${teamId})
          ON CONFLICT (user_id, stage, slot) DO NOTHING
          RETURNING 1
        `) as unknown[];
        if (res.length > 0) restored++;
      }
    }
  }

  await sql`DELETE FROM tournament_settings WHERE key = 'bracket_reopen'`;
  return { closed: true, restored };
}
