# Data Flow: From Cron Job to Leaderboard & Awards

A plain-English walkthrough of how match results travel from the real world into scores and awards.

---

## The Big Picture

```
football-data.org API
   ↓  (~2 min, match-aware)        ↓  (~15 min)
  /api/cron/results               /api/cron/news
   └─ gated: full sync only        ├─ news RSS sync
      during match windows         └─ ungated results backstop
        ↓                                  ↓
  processMatches()  ◀───────────────────────┘
        ↓
   results table (DB)
        ↓              ↓
  Leaderboard       Snapshots
  (on demand,       (auto, each round)
   auto-refresh)        ↓
        ↓              Awards
   scoreUser()
```

---

## Step 1 — The Crons Fire

There are **two** cron-job.org schedules (both pass `?secret=<CRON_SECRET>`):

1. **`GET /api/cron/results` — every ~2 minutes (fast, match-aware).**
   The handler (`app/api/cron/results/route.ts`) calls `runResultsSyncIfActive()`, which makes **one** football-data call for the match window (yesterday→tomorrow). If no match is live, recently finished (within ~3h of kickoff), or about to start (~10 min), it returns `{ idle: true }` immediately — **no database access**, keeping idle ticks cheap. During a match window it runs the full results sync. This is what makes standings/leaderboard land within ~2 min of full time.

2. **`GET /api/cron/news` — every ~15 minutes (slow).**
   Runs the RSS news sync **and** an *ungated* `runResultsSync()` as a correctness backstop — so even if the fast gate ever misses a late result, it's caught within ~15 min (the old behavior, as a floor).

Why two schedules: hitting the news RSS feeds + writing standings every 2 minutes would waste requests and keep Neon awake 24/7. football-data's free tier (10 req/min, no daily cap) easily affords the 2-min results polling; the binding limits are Vercel invocations and Neon compute, which the match-aware gate protects.

> **Note:** the free tier delivers scores *delayed*, not truly live in-match — and group standings only change at full time anyway. So the win here is **fast pickup after a match ends**, not ball-by-ball live scores.

---

## Step 2 — Fetching Match Data from football-data.org

`lib/api-football.ts` makes two kinds of requests:

### Match results
`GET /v4/competitions/WC/matches?status=FINISHED&dateFrom=X&dateTo=X`

Returns a list of finished matches. For each one we pull out:
- The fixture ID (so we can avoid processing it twice)
- The stage — "GROUP_STAGE", "ROUND_OF_32", etc. (we normalize these to lowercase: "group stage", "round of 32")
- Home and away team names
- Who won — `HOME_TEAM`, `AWAY_TEAM`, or `DRAW`
- How it ended — `REGULAR`, `EXTRA_TIME`, or `PENALTY_SHOOTOUT`

This becomes a `CompletedMatch` object that the rest of the pipeline works with.

### Group standings (called per group during group stage)
`GET /v4/competitions/WC/standings`

Returns the live 1st/2nd/3rd/4th position for every group, updated after every match. We use this to write group-stage results to the DB.

---

## Step 3 — Processing Matches (`lib/process-matches.ts`)

For each `CompletedMatch` the cron received:

### 3a — Idempotency check
We look up the fixture ID in the `processed_fixtures` table. If it's already there, we skip it. This means the cron is safe to fire repeatedly — it won't double-score anything.

### 3b — Group stage match
If the round is `"group stage"`:

1. **Individual match winner** — if there was a winner (not a draw), we write a row to `results` with `stage="gm"` and `slot=<fixture ID>`. These "gm" rows are only used for the Heart Pick power (kids earn +1 point per win for their chosen team).

2. **Live group standings** — we call the standings endpoint to get the current 1st/2nd/3rd/4th for that group, then write four rows to `results`:
   - `stage="group"`, `slot="A"`, `team_id=<1st place team>`
   - `stage="runner"`, `slot="A"`, `team_id=<2nd place team>`
   - `stage="third"`, `slot="A"`, `team_id=<3rd place team>`
   - `stage="fourth"`, `slot="A"`, `team_id=<4th place team>`

   These rows use `DO UPDATE` so they get overwritten after every match — the standings stay live as the group plays out. Final standings at the end of matchday 3 are what count for scoring.

### 3c — Knockout match
If the round is anything else (R32, R16, QF, SF, Final) and there's a winner:

1. `findKnockoutSlot()` figures out which bracket slot this match belongs to (e.g. `r32:m3`) by looking at who the two teams are and which results are already in the DB.

2. We write one row: `stage="r32"` (or r16/qf/sf/final), `slot="m3"`, `team_id=<winner>`, `was_shootout=true/false`.

### 3d — Mark as processed
Fixture ID goes into `processed_fixtures` so it's never touched again.

---

## Step 4 — Scoring (`lib/scoring.ts`)

Scoring is **not stored** — it's calculated fresh every time someone loads the leaderboard. The leaderboard API (`/api/leaderboard`) loads all users, all picks, all results, and all snapshots from the DB, then runs `scoreUser()` for each person.

### Group stage points
For each of the 12 groups (A–L):
- **+2 pts** — you picked this team to finish 1st or 2nd, and they actually finished 1st or 2nd (order doesn't matter, just that they advanced)
- **+1 pt** — you got the exact position right (e.g. picked them 1st and they finished 1st)

So a perfect group: you can earn up to 3 pts per team × 2 teams = 6 pts, plus 1 pt each for the 3rd and 4th place picks = up to 8 pts per group × 12 groups = **96 pts max from group stage**.

### Knockout points
For each round, a correct pick earns:

| Round  | Points |
|--------|--------|
| R32    | 2      |
| R16    | 4      |
| QF     | 8      |
| SF     | 16     |
| Final  | 32     |

**Shootout mercy rule** — if your pick lost *in a penalty shootout*, you get half points instead of zero. It was almost right.

### Champion bonus
+10 pts if you correctly picked the tournament winner in your champion pick.

### Special powers (family edition only)
- **Star Power** — one knockout pick is starred. If it's correct, those points double. (e.g. a correct R16 pick normally worth 4 pts becomes 8 pts.)
- **Heart Pick** — kids choose a team before the tournament. They earn +1 pt for every single match that team wins, from group stage through the final.
- **Charge Up** — if a kid's champion pick wins AND charge-up was active, they earn an extra +10 pts on top of the base +10 bonus.
- **Kaboose Boost** — if a kid started a knockout round in dead last place, they earn +3 pts for that round. (Based on standings snapshots — see Step 5.)

---

## Step 5 — Standings Snapshots (`lib/snapshots.ts`)

Some awards and kid powers need to know what the standings looked like *at the start of a round*, not at the end. That's what snapshots are for.

A snapshot is a frozen copy of the leaderboard (name, rank, score) at a specific moment. There are five snapshot points:

| Snapshot    | Taken when…                                                    |
|-------------|----------------------------------------------------------------|
| `pre_r32`   | Keith clicks "Lock Group Stage & Open Bracket" in the admin    |
| `pre_r16`   | The cron detects all 16 R32 results are in                     |
| `pre_qf`    | The cron detects all 8 R16 results are in                      |
| `pre_sf`    | The cron detects all 4 QF results are in                       |
| `pre_final` | The cron detects both SF results are in                        |

Snapshots are used for:
- **Kaboose Boost** — was this kid in last place when this round started?
- **Pacemaker award** — who held the lead heading into the most rounds?
- **Comeback Kid award** — who improved their rank the most from `pre_r32` to the final standings?

---

## Step 6 — Awards (`lib/awards.ts`)

Awards are computed manually by Keith from the admin panel (or auto-run at the end). `computeAwards()` takes all users, picks, results, score breakdowns, and snapshots, and produces 17 awards:

### Glory
| Award | How it's determined |
|-------|---------------------|
| **The Champion** | Highest total score |
| **True Believer** | Correctly picked the tournament winner as champion |
| **The Closer** | Most points from QF + SF + Final combined |
| **The Hipster** | Correctly backed the biggest underdog the furthest into the bracket |
| **Bracket Brainiac** | Highest percentage of correct knockout picks |
| **The Pacemaker** | Led the standings entering the most rounds (from snapshots) |
| **The Hand of God** | Correctly predicted the 1st-place team in all 12 groups |

### Funny & Consolation
| Award | How it's determined |
|-------|---------------------|
| **Wooden Spoon** | Lowest total score |
| **Heartbreak Hotel** | Most picks eliminated in penalty shootouts |
| **The Human Coin Flip** | Knockout accuracy closest to exactly 50% |
| **Help, I've Gone Cross-Eyed** | Most picks where the team advanced but finished in the wrong top-2 position |
| **The Trendsetter** | Most unique knockout picks that nobody else made |
| **Reverse Oracle** | Most incorrect knockout picks |
| **Early Retirement** | Champion pick was eliminated in the group stage |

### Special
| Award | How it's determined |
|-------|---------------------|
| **Upset Artist** | Most correctly predicted upsets (weaker seed beats stronger seed) |
| **Comeback Kid** | Biggest rank improvement from pre-bracket standings to the final result |
| **Close But No Cigar** | Champion pick made the Final but lost |

---

## What Lives Where in the Database

| Table | What's in it |
|-------|-------------|
| `users` | Everyone who signed up |
| `picks` | Every pick everyone made (group stage + bracket + champion) |
| `results` | Match results written by the cron (group standings + knockout winners + gm rows) |
| `processed_fixtures` | IDs of matches already processed — prevents double-counting |
| `tournament_settings` | Current phase (phase1_open → phase2_open → complete, etc.) |
| `standings_snapshots` | Frozen leaderboard at the start of each knockout round |
| `awards` | Final award results (written by admin, re-runnable) |
