import { getSql } from "@/lib/db";

// Per-player bracket freeze. Lets an admin lock everyone's knockout picks while
// leaving specific players open (e.g. a young kid whose parent is still filling in
// their bracket) — finer-grained than the all-or-nothing phase lock. Stored under
// the 'bracket_lock' setting as { active: boolean, exempt: number[] (user ids) }.
// Returns true when THIS user's knockout picks should be frozen.
export async function bracketLockedFor(sql: ReturnType<typeof getSql>, userId: number): Promise<boolean> {
  const rows = await sql`SELECT value FROM tournament_settings WHERE key = 'bracket_lock' LIMIT 1` as { value: string }[];
  if (!rows[0]) return false;
  try {
    const cfg = JSON.parse(rows[0].value) as { active?: boolean; exempt?: number[] };
    if (!cfg.active) return false;
    return !(Array.isArray(cfg.exempt) && cfg.exempt.includes(userId));
  } catch {
    return false;
  }
}
