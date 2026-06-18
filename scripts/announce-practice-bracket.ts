// One-off: have The Gaffer announce that the Practice Bracket is open to play with,
// with a quick note on how its Round of 32 is seeded from the live standings under
// official FIFA 2026 rules. Deduped by event_key, so it's safe to re-run.
// Run: DATABASE_URL=… ANTHROPIC_API_KEY=… npx tsx --env-file=.env.local scripts/announce-practice-bracket.ts
import { initDb, getSql } from "../lib/db";
import { postGafferAnnouncement } from "../lib/announcer";

// Plain, factually-correct template. The Gaffer re-voices this in persona at post
// time (lib/gaffer-voice.ts), keeping every fact but tightening it to a line or two.
const PLAIN =
  "🎮 The Practice Bracket is OPEN — go play around with it! The Round of 32 is built live from the current group standings under official FIFA 2026 rules (the 12 group winners, 12 runners-up, and the 8 best third-placed teams); from there you click through to play out the whole bracket. Nothing's saved, so experiment all you like.";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  await initDb();
  const posted = await postGafferAnnouncement(getSql(), "practice-bracket-open", PLAIN);
  console.log(
    posted
      ? "Posted the Practice Bracket announcement."
      : "Already announced (event_key exists) — nothing posted.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
