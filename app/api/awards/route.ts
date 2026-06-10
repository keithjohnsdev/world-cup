import { NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await initDb();
  const sql = getSql();
  const [visRows, rows] = await Promise.all([
    sql`SELECT value FROM tournament_settings WHERE key = 'awards_visible' LIMIT 1`,
    sql`SELECT name, user_name, reason FROM awards ORDER BY name`,
  ]) as [{ value: string }[], { name: string; user_name: string; reason: string }[]];

  const visible = visRows[0]?.value === "true";
  return NextResponse.json({ visible, awards: visible ? rows : [] });
}
