import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { fetchDisplayMatches, type DisplayMatch } from "@/lib/api-football";
import { apiNameToTeamId } from "@/lib/team-mapping";

// One match with our team ids resolved, ready for the client to slice by team.
interface MatchDTO extends DisplayMatch {
  homeId: string | null;
  awayId: string | null;
  winnerId: string | null;
}

// Every real WC match with scores powers the results bracket's team-history modal.
// football-data's whole-tournament call is a single request, but many family
// members may open the tab at once — so cache the mapped payload in-process with a
// short TTL and fall back to the last good copy if a refetch fails. This keeps us
// well under the free tier's 10 req/min without ever showing a hard error.
const TTL_MS = 90_000;
let cache: { at: number; data: MatchDTO[] } | null = null;

async function getMatches(): Promise<MatchDTO[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const raw = await fetchDisplayMatches();
    const data = raw.map((m): MatchDTO => ({
      ...m,
      homeId: m.homeTeamName ? apiNameToTeamId(m.homeTeamName) : null,
      awayId: m.awayTeamName ? apiNameToTeamId(m.awayTeamName) : null,
      winnerId: m.winnerName ? apiNameToTeamId(m.winnerName) : null,
    }));
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    if (cache) return cache.data; // serve stale rather than fail
    throw err;
  }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-session-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const auth = (await sql`SELECT id FROM users WHERE session_token = ${token}`) as unknown[];
  if (!auth.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json({ matches: await getMatches() });
  } catch {
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}
