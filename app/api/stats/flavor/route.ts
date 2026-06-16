import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { type Stat } from "@/lib/stats";
import { generateHeadlines, flavorEnabled } from "@/lib/stats-flavor";

// Lazily generates punchy LLM headlines for the stats that don't have one cached
// yet, then caches them by signature. Triggered by the Stats tab after first
// render. Degrades silently (returns {}) when the API key is unset.
export async function POST(req: NextRequest) {
  await initDb();
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const auth = await sql`SELECT id FROM users WHERE session_token = ${token}` as { id: number }[];
  if (!auth.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!flavorEnabled()) return NextResponse.json({ headlines: {} });

  const snapRows = await sql`SELECT data FROM stats_snapshot WHERE id = 1` as { data: Stat[] }[];
  const stats = snapRows[0]?.data ?? [];
  if (!stats.length) return NextResponse.json({ headlines: {} });

  // Only generate for signatures not already cached.
  const cached = await sql`SELECT signature FROM stats_flavor` as { signature: string }[];
  const have = new Set(cached.map((r) => r.signature));
  const missing = stats.filter((s) => !have.has(s.signature));
  if (!missing.length) return NextResponse.json({ headlines: {} });

  const headlines = await generateHeadlines(missing);

  for (const [signature, headline] of Object.entries(headlines)) {
    await sql`
      INSERT INTO stats_flavor (signature, headline) VALUES (${signature}, ${headline})
      ON CONFLICT (signature) DO NOTHING
    `;
  }

  return NextResponse.json({ headlines });
}
