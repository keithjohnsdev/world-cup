// One-time activation for the semifinal re-pick window (see lib/bracket-reopen.ts).
//
// The QF→SF pairing bug meant every player's sf/final picks were made on the wrong
// matchups. Their four semifinalists (qf picks) are correct, so this:
//   1. backs up each player's raw sf/final picks           (bracket_reopen_backup)
//   2. computes a migrated fallback — their original intent mapped onto the CORRECT
//      semifinals (qf1·qf3, qf2·qf4) — to restore for anyone who doesn't re-pick
//      before the deadline                                  (bracket_reopen_fallback)
//   3. clears sf/final picks so players re-pick fresh
//   4. opens the window with a hard deadline at France–Spain kickoff (bracket_reopen)
//
// RUN ONCE, AFTER THE CODE IS DEPLOYED (so the re-pick UI is live when picks clear).
//   node scripts/reopen-semifinals.mjs           # activate
//   node scripts/reopen-semifinals.mjs --dry      # preview, no writes
//   node scripts/reopen-semifinals.mjs --revert   # undo: restore raw picks, close window
//
// Reads DATABASE_URL from .env.local — which points at the live Neon DB.

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const DEADLINE = "2026-07-14T19:00:00Z"; // France vs Spain kickoff (real SF1)

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/DATABASE_URL=(.*)/)[1].trim();
const sql = neon(url);

const mode = process.argv.includes("--revert") ? "revert" : process.argv.includes("--dry") ? "dry" : "activate";

// Migrate a player's original picks onto the corrected bracket. Their qf winners
// (A=qf1, B=qf2, C=qf3, D=qf4) stay put; the corrected semis pair A·C and B·D. For
// each corrected semi, keep whichever team the player advanced FURTHER in their old
// bracket (won their old semi / became their bracket champion). A semi is left blank
// only when the player advanced NEITHER of its teams to their old final (no signal).
function migrate(p) {
  const A = p["qf:m1"], B = p["qf:m2"], C = p["qf:m3"], D = p["qf:m4"];
  const oldSf1 = p["sf:m1"], oldSf2 = p["sf:m2"], oldFinal = p["final:m1"];
  const depth = (t) => (!t ? 0 : t === oldFinal ? 3 : t === oldSf1 || t === oldSf2 ? 2 : 1);
  const higher = (x, y) => (!x || !y || depth(x) === depth(y) ? undefined : depth(x) > depth(y) ? x : y);

  const out = {};
  const newSf1 = higher(A, C); // corrected SF1 = qf1 vs qf3
  const newSf2 = higher(B, D); // corrected SF2 = qf2 vs qf4
  if (newSf1) out["sf:m1"] = newSf1;
  if (newSf2) out["sf:m2"] = newSf2;
  // The bracket champion always advanced furthest in its own pair, so it's that
  // semi's migrated winner — carry it straight to the final.
  if (oldFinal && (oldFinal === newSf1 || oldFinal === newSf2)) out["final:m1"] = oldFinal;
  return out;
}

const nameOf = new Map();
async function loadNames() {
  const us = await sql`SELECT id, name FROM users`;
  for (const u of us) nameOf.set(u.id, u.name);
}

async function getSetting(key) {
  const r = await sql`SELECT value FROM tournament_settings WHERE key = ${key} LIMIT 1`;
  return r[0]?.value ?? null;
}
async function setSetting(key, value) {
  await sql`
    INSERT INTO tournament_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

async function activate(dry) {
  if (await getSetting("bracket_reopen")) {
    console.log("✋ bracket_reopen already set — window is already open. Aborting (run --revert first to redo).");
    return;
  }

  const rows = await sql`SELECT user_id, stage, slot, team_id FROM picks WHERE stage IN ('qf','sf','final')`;
  const byUser = {};
  for (const r of rows) (byUser[r.user_id] ??= {})[`${r.stage}:${r.slot}`] = r.team_id;

  const backup = {};   // raw sf/final per user (for revert)
  const fallback = {}; // migrated picks to restore at close
  for (const [uid, p] of Object.entries(byUser)) {
    const raw = {};
    for (const k of ["sf:m1", "sf:m2", "final:m1"]) if (p[k]) raw[k] = p[k];
    if (Object.keys(raw).length) backup[uid] = raw;
    const fb = migrate(p);
    if (Object.keys(fb).length) fallback[uid] = fb;
  }

  console.log(`\nPlayers: ${Object.keys(byUser).length}\n`);
  for (const [uid, p] of Object.entries(byUser)) {
    const fb = fallback[uid] ?? {};
    const g = (k) => p[k] ?? "—";
    console.log(`#${uid} ${nameOf.get(Number(uid)) ?? ""}`);
    console.log(`   qf: ${g("qf:m1")}, ${g("qf:m2")}, ${g("qf:m3")}, ${g("qf:m4")}`);
    console.log(`   was  → sf1=${g("sf:m1")} sf2=${g("sf:m2")} final=${g("final:m1")}`);
    console.log(`   fallback → sf1=${fb["sf:m1"] ?? "(re-pick)"} sf2=${fb["sf:m2"] ?? "(re-pick)"} final=${fb["final:m1"] ?? "(re-pick)"}`);
  }

  if (dry) { console.log("\n(dry run — no writes)"); return; }

  await setSetting("bracket_reopen_backup", JSON.stringify(backup));
  await setSetting("bracket_reopen_fallback", JSON.stringify(fallback));
  await sql`DELETE FROM picks WHERE stage IN ('sf','final')`;
  await setSetting("bracket_reopen", JSON.stringify({ stages: ["sf", "final"], until: DEADLINE }));

  console.log(`\n✅ Window OPEN. sf/final cleared, backup+fallback stored. Auto-closes ${DEADLINE}.`);
}

async function revert() {
  const raw = await getSetting("bracket_reopen_backup");
  if (!raw) { console.log("No bracket_reopen_backup found — nothing to revert."); return; }
  const backup = JSON.parse(raw);
  let n = 0;
  for (const [uid, slots] of Object.entries(backup)) {
    for (const [stageSlot, teamId] of Object.entries(slots)) {
      const [stage, slot] = stageSlot.split(":");
      await sql`
        INSERT INTO picks (user_id, stage, slot, team_id)
        VALUES (${Number(uid)}, ${stage}, ${slot}, ${teamId})
        ON CONFLICT (user_id, stage, slot) DO UPDATE SET team_id = EXCLUDED.team_id
      `;
      n++;
    }
  }
  await sql`DELETE FROM tournament_settings WHERE key IN ('bracket_reopen','bracket_reopen_fallback','bracket_reopen_backup')`;
  console.log(`↩ Reverted ${n} picks from backup and closed the window.`);
}

await loadNames();
if (mode === "revert") await revert();
else await activate(mode === "dry");
