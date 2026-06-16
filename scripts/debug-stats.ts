import { initDb, getSql } from "../lib/db";
import { type Stat } from "../lib/stats";
async function main() {
  await initDb();
  const rows = await getSql()`SELECT data FROM stats_snapshot WHERE id = 1` as { data: Stat[] }[];
  const data = rows[0].data;
  for (const cat of ["pool", "tournament"] as const) {
    const items = data.filter((s) => s.category === cat);
    console.log(`\n=== ${cat.toUpperCase()} (${items.length}) ===`);
    for (const s of items) console.log(`${s.emoji} ${s.title}: ${s.value}${s.detail ? `  — ${s.detail}` : ""}`);
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
