// Curated "Interesting Facts about World Cup 2026" — the content behind the
// "World Cup" tab of the Stat Sheet. These replace the old computed match-records.
// Most are evergreen (format, hosts, debutants, milestones) and hand-sourced from
// tournament reporting; a couple fold in LIVE numbers from the matches we already
// fetch, so they update as the tournament rolls on. Returned without a signature —
// computeStats() wraps each through mk() so it joins the normal snapshot / flavor
// (LLM headline) / archive machinery unchanged.

import type { Stat } from "@/lib/stats";

type RawFact = Omit<Stat, "signature">;

// Live context derived from the finished matches we already have on hand.
export interface WcFactContext {
  matchesPlayed: number;
  totalGoals: number;
}

// Qatar 2022 set the single-tournament record across 64 games; 2026 has up to 104.
const GOALS_RECORD = 172;
const TOTAL_MATCHES = 104;

export function buildWcFacts({ matchesPlayed, totalGoals }: WcFactContext): RawFact[] {
  const facts: RawFact[] = [];

  // ── Live: goal-record chase (updates as goals go in) ─────────────────────────
  const broken = totalGoals > GOALS_RECORD;
  facts.push({
    key: "wc_goal_record", category: "tournament", emoji: "⚽",
    title: "Goal Glut",
    value: broken
      ? `${totalGoals} goals — the all-time record has fallen`
      : `${totalGoals} goals so far — chasing 172`,
    detail: broken
      ? "Past Qatar 2022's 172 in just 64 games"
      : "Qatar 2022 managed 172 across 64 games",
    explanation: broken
      ? `A combined ${totalGoals} goals have already been scored — past the 172 managed across 64 games at Qatar 2022. With up to ${TOTAL_MATCHES} games in this expanded 48-team format, the single-tournament goals record has been smashed.`
      : `${totalGoals} goals have been scored so far. The single-tournament record is ${GOALS_RECORD} (Qatar 2022, 64 games) — and with ${TOTAL_MATCHES} games scheduled in the new 48-team format, it's widely expected to fall.`,
  });

  // ── Live: how far through the tournament we are ──────────────────────────────
  const pct = Math.round((matchesPlayed / TOTAL_MATCHES) * 100);
  facts.push({
    key: "wc_progress", category: "tournament", emoji: "📊",
    title: "The Road So Far",
    value: `${matchesPlayed} of ${TOTAL_MATCHES} matches played`,
    detail: `${pct}% of the tournament complete`,
    explanation: `This is the biggest World Cup ever — ${TOTAL_MATCHES} matches in all. ${matchesPlayed} ${matchesPlayed === 1 ? "has" : "have"} been completed so far, about ${pct}% of the way through.`,
  });

  // ── Evergreen facts about the tournament ─────────────────────────────────────
  facts.push(
    {
      key: "wc_biggest", category: "tournament", emoji: "🌍",
      title: "Biggest Cup Ever",
      value: "First 48-team World Cup — 104 matches",
      detail: "Up from 32 teams and 64 matches",
      explanation: "2026 is the first World Cup with 48 teams instead of 32. That means 104 matches (up from 64) and a brand-new Round of 32 before the Round of 16 — the largest tournament in the competition's history.",
    },
    {
      key: "wc_three_hosts", category: "tournament", emoji: "🤝",
      title: "Three Host Nations",
      value: "USA, Canada & Mexico — 16 host cities",
      detail: "First World Cup shared by three countries",
      explanation: "For the first time, a single World Cup is co-hosted by three nations across 16 cities — 11 in the USA, three in Mexico and two in Canada. Toronto and Vancouver are hosting World Cup football for the very first time.",
    },
    {
      key: "wc_debutants", category: "tournament", emoji: "🆕",
      title: "First-Timers",
      value: "Cabo Verde, Curaçao, Jordan & Uzbekistan debut",
      detail: "Most debut nations at a single World Cup",
      explanation: "Four nations are making their World Cup debut — Cabo Verde, Curaçao, Jordan and Uzbekistan — the most first-time qualifiers at any single tournament, a record in itself.",
    },
    {
      key: "wc_six_timers", category: "tournament", emoji: "🐐",
      title: "Sixth Time Around",
      value: "Messi, Ronaldo & Ochoa reach a 6th World Cup",
      detail: "First players ever to do it",
      explanation: "Lionel Messi, Cristiano Ronaldo and goalkeeper Guillermo Ochoa become the first players in history to appear at six different World Cups.",
    },
    {
      key: "wc_no_italy", category: "tournament", emoji: "😱",
      title: "Notable Absentee",
      value: "Italy missed out — again",
      detail: "Four-time champions, absent a third straight time",
      explanation: "Italy, four-time world champions, failed to qualify for a third consecutive World Cup — one of the biggest names watching this one from home.",
    },
    {
      key: "wc_mexico_threepeat", category: "tournament", emoji: "🇲🇽",
      title: "Mexico Makes History",
      value: "First country to host three World Cups",
      detail: "1970, 1986 and now 2026",
      explanation: "With 2026, Mexico becomes the first nation ever to host the men's World Cup three times, after 1970 and 1986.",
    },
    {
      key: "wc_azteca", category: "tournament", emoji: "🏟️",
      title: "The Cathedral",
      value: "Estadio Azteca — first stadium at three World Cups",
      detail: "Mexico City, hosting since 1970",
      explanation: "Estadio Azteca in Mexico City becomes the first stadium ever to host matches at three different World Cups (1970, 1986 and 2026), including this tournament's opening match.",
    },
    {
      key: "wc_red_opener", category: "tournament", emoji: "🟥",
      title: "Fiery Opener",
      value: "Three red cards in the opening match",
      detail: "Mexico vs. South Africa, June 11",
      explanation: "The tournament's opening match saw three red cards — the most ill-disciplined start to a World Cup on record.",
    },
    {
      key: "wc_youngest", category: "tournament", emoji: "👶",
      title: "Teen Sensation",
      value: "Gilberto Mora — among the youngest ever",
      detail: "Mexico's 17-year-old",
      explanation: "Mexico's Gilberto Mora, at 17 years and 240 days, is one of the youngest players ever to feature at a World Cup.",
    },
    {
      key: "wc_squads", category: "tournament", emoji: "👥",
      title: "By The Numbers",
      value: "1,248 players from 71 countries",
      detail: "Drawn from 449 clubs worldwide",
      explanation: "The 48 squads field a record 1,248 players, drawn from 449 clubs across 71 countries — the most globally represented World Cup ever.",
    },
    {
      key: "wc_final", category: "tournament", emoji: "🏆",
      title: "The Big Stage",
      value: "Final at MetLife Stadium, July 19",
      detail: "Biggest venue: AT&T Stadium, Dallas (94,000)",
      explanation: "The 2026 final will be played at MetLife Stadium near New York on July 19. The largest venue is AT&T Stadium in Dallas (94,000); AT&T and Atlanta's Mercedes-Benz Stadium host the most games — nine apiece.",
    },
  );

  return facts;
}
