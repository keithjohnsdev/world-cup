import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | undefined;
let _initialized = false;

export function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export async function initDb() {
  if (_initialized) return;
  _initialized = true;
  const sql = getSql();

  // ── Core tables ──────────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id                  SERIAL PRIMARY KEY,
      name                VARCHAR(100) NOT NULL,
      session_token       VARCHAR(64)  UNIQUE NOT NULL,
      is_kid              BOOLEAN      DEFAULT false,
      chargeup_active     BOOLEAN      DEFAULT false,
      heart_pick_team_id  VARCHAR(10),
      created_at          TIMESTAMP    DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_kid             BOOLEAN  DEFAULT false`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS heart_pick_team_id VARCHAR(10)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS chargeup_active    BOOLEAN  DEFAULT false`;

  // All user selections — group picks, bracket picks, and meta (champion, star, etc.)
  // stage ∈ {group, runner, third, fourth, champion, meta, heart, r32, r16, qf, sf, final}
  // Phase gating is enforced in the API (not here) to stay flexible.
  await sql`
    CREATE TABLE IF NOT EXISTS picks (
      id           SERIAL  PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      stage        VARCHAR(30) NOT NULL,
      slot         VARCHAR(30) NOT NULL,
      team_id      VARCHAR(10) NOT NULL,
      is_star_power BOOLEAN DEFAULT false,
      created_at   TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, stage, slot)
    )
  `;
  await sql`ALTER TABLE picks ADD COLUMN IF NOT EXISTS is_star_power BOOLEAN DEFAULT false`;

  // Group and knockout results written by the cron.
  // stage ∈ {group, runner, third, fourth, gm, r32, r16, qf, sf, final}
  // was_shootout enables the mercy-rule half-point in knockout scoring.
  await sql`
    CREATE TABLE IF NOT EXISTS results (
      id           SERIAL  PRIMARY KEY,
      stage        VARCHAR(30) NOT NULL,
      slot         VARCHAR(30) NOT NULL,
      team_id      VARCHAR(10) NOT NULL,
      was_shootout BOOLEAN     DEFAULT false,
      created_at   TIMESTAMP   DEFAULT NOW(),
      UNIQUE(stage, slot)
    )
  `;

  // Idempotency guard — prevents reprocessing the same fixture twice.
  await sql`
    CREATE TABLE IF NOT EXISTS processed_fixtures (
      fixture_id   INTEGER PRIMARY KEY,
      processed_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Teams that have played at least one match. A group-stage pick only scores
  // once its team appears here, so positions seeded into the standings before a
  // team has kicked a ball don't award premature points. Populated by the cron
  // from group standings (playedGames > 0).
  await sql`
    CREATE TABLE IF NOT EXISTS teams_played (
      team_id         VARCHAR(10) PRIMARY KEY,
      first_played_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Live league points (3/1/0) per team in the group stage, mirrored from the
  // football-data.org standings table on every group-match processing run.
  // Surfaced in the player score view next to each team's "Actual" flag.
  await sql`
    CREATE TABLE IF NOT EXISTS group_points (
      team_id      VARCHAR(10) PRIMARY KEY,
      points       INTEGER     NOT NULL DEFAULT 0,
      played_games INTEGER     NOT NULL DEFAULT 0,
      updated_at   TIMESTAMP   DEFAULT NOW()
    )
  `;

  // Phase FSM: phase1_open → phase1_locked → phase2_open → phase2_locked → complete
  await sql`
    CREATE TABLE IF NOT EXISTS tournament_settings (
      key        VARCHAR(50) PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO tournament_settings (key, value)
    VALUES ('phase', 'phase1_open')
    ON CONFLICT (key) DO NOTHING
  `;
  await sql`
    INSERT INTO tournament_settings (key, value)
    VALUES ('awards_visible', 'false')
    ON CONFLICT (key) DO NOTHING
  `;

  // ── Standings snapshots ───────────────────────────────────────────────────────
  // Taken at the start of each knockout round (before those round's picks are scored).
  // round ∈ {pre_r32, pre_r16, pre_qf, pre_sf, pre_final}
  //   pre_r32  — snapshot when phase1 locks and phase2 opens
  //   pre_r16  — snapshot after all 16 R32 results are in
  //   pre_qf   — snapshot after all 8 R16 results are in
  //   pre_sf   — snapshot after all 4 QF results are in
  //   pre_final — snapshot after both SF results are in
  //
  // Used for:
  //   • Kaboose Boost: +3 pts each round a kid started in last place
  //   • Pacemaker award: who held the lead for the most rounds
  //   • Comeback Kid award: biggest rank swing across the tournament
  await sql`
    CREATE TABLE IF NOT EXISTS standings_snapshots (
      round          VARCHAR(20) NOT NULL,
      user_id        INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rank           INTEGER     NOT NULL,
      total_score    INTEGER     NOT NULL,
      group_score    INTEGER     NOT NULL DEFAULT 0,
      bracket_score  INTEGER     NOT NULL DEFAULT 0,
      PRIMARY KEY (round, user_id)
    )
  `;

  // ── Points history ──────────────────────────────────────────────────────────
  // One row per (user, finished match): the player's cumulative score as of that
  // match. Powers the "points over time" line graph below the leaderboard.
  // Fully rebuilt by rebuildPointsHistory() (lib/points-history.ts) — a clean
  // chronological replay of every finished match — so it's never partially stale.
  // game_index is the X-axis ordinal; fixture_id keys the rebuild's upsert.
  await sql`
    CREATE TABLE IF NOT EXISTS points_history (
      user_id       INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_index    INTEGER     NOT NULL,
      fixture_id    INTEGER     NOT NULL,
      match_utc     TIMESTAMPTZ,
      label         VARCHAR(80),
      total         INTEGER     NOT NULL,
      group_score   INTEGER     NOT NULL DEFAULT 0,
      bracket_score INTEGER     NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, fixture_id)
    )
  `;

  // ── Stats / fun facts ───────────────────────────────────────────────────────
  // Single materialised snapshot of all computed tournament + pool stats, rebuilt
  // by rebuildStats() (lib/stats.ts) whenever results change. One row (id=1).
  await sql`
    CREATE TABLE IF NOT EXISTS stats_snapshot (
      id          INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      data        JSONB       NOT NULL,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Lazy LLM headline cache keyed by a stat's value-signature, so a punchy
  // "did you know" line is generated at most once per distinct value (mirrors
  // the news recap cache). Populated on demand by /api/stats/flavor.
  await sql`
    CREATE TABLE IF NOT EXISTS stats_flavor (
      signature  TEXT PRIMARY KEY,
      headline   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Daily archive of the stat sheet (one row per UTC calendar day, latest rebuild
  // of the day wins). Lets the Stats tab's calendar browse how the sheet looked on
  // past days. Accrues forward — earlier days weren't stored.
  await sql`
    CREATE TABLE IF NOT EXISTS stats_archive (
      snapshot_date DATE        PRIMARY KEY,
      data          JSONB       NOT NULL,
      computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── News ──────────────────────────────────────────────────────────────────────
  // Aggregated World Cup stories pulled from reputable RSS feeds by the cron.
  // url is the primary key, giving natural idempotency across runs (a story keeps
  // its row and just refreshes its traction/source_count). countries holds the
  // matched team ids (e.g. ["USA","MEX"]); source_count is how many distinct
  // outlets are covering the same story (the traction signal). Old rows are pruned
  // by the sync, so this table stays small.
  await sql`
    CREATE TABLE IF NOT EXISTS news_articles (
      url           TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      source        TEXT NOT NULL,
      summary       TEXT,
      image_url     TEXT,
      published_at  TIMESTAMPTZ NOT NULL,
      countries     JSONB NOT NULL DEFAULT '[]',
      cluster_id    TEXT,
      source_count  INTEGER NOT NULL DEFAULT 1,
      traction      DOUBLE PRECISION NOT NULL DEFAULT 0,
      fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS news_published_idx ON news_articles (published_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS news_traction_idx ON news_articles (traction DESC)`;

  // In-app reader recap: an original, Claude-generated summary of the story so
  // readers stay on our site (no ad-stripped republishing of the source). Lazily
  // generated on first open and cached here, so we pay for it once per story.
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS recap    TEXT`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS recap_at TIMESTAMPTZ`;

  // ── Message board ─────────────────────────────────────────────────────────────
  // Family chatter — one row per posted message. user_name is denormalised (like
  // the awards table) so a message keeps its author label even if the user row is
  // later removed; the FK is ON DELETE CASCADE so deleting a player clears theirs.
  //
  // The Gaffer (the automated announcer) posts here too: is_announcer = true,
  // user_id = NULL. event_key is its idempotency guard — each tournament event
  // (a knockout result, a champion crashing out, a new table-topper) carries a
  // stable key so the every-few-minutes results cron announces it exactly once.
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id           SERIAL      PRIMARY KEY,
      user_id      INTEGER     REFERENCES users(id) ON DELETE CASCADE,
      user_name    VARCHAR(100) NOT NULL,
      body         TEXT        NOT NULL,
      is_announcer BOOLEAN     NOT NULL DEFAULT false,
      event_key    TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_announcer BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_key TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS messages_created_idx ON messages (created_at DESC)`;
  // Idempotency for announcer posts (NULL for human messages — Postgres allows
  // many NULLs in a unique index). ON CONFLICT (event_key) targets this.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS messages_event_key_idx ON messages (event_key)`;

  // ── Awards ────────────────────────────────────────────────────────────────────
  // Computed by the admin after the tournament (or after each round for live awards).
  // One row per award, re-runnable (DO UPDATE).
  await sql`
    CREATE TABLE IF NOT EXISTS awards (
      name       VARCHAR(100) PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id),
      user_name  VARCHAR(100),
      reason     TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
}
