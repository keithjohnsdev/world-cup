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

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      session_token VARCHAR(64) UNIQUE NOT NULL,
      is_kid BOOLEAN DEFAULT false,
      heart_pick_team_id VARCHAR(10),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_kid BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS heart_pick_team_id VARCHAR(10)`;

  await sql`
    CREATE TABLE IF NOT EXISTS picks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      stage VARCHAR(30) NOT NULL,
      slot VARCHAR(30) NOT NULL,
      team_id VARCHAR(10) NOT NULL,
      is_star_power BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, stage, slot)
    )
  `;

  await sql`ALTER TABLE picks ADD COLUMN IF NOT EXISTS is_star_power BOOLEAN DEFAULT false`;

  // Actual tournament outcomes entered by admin.
  // stage/slot mirrors the picks table convention.
  // was_shootout enables the shootout mercy rule (half points).
  await sql`
    CREATE TABLE IF NOT EXISTS results (
      id SERIAL PRIMARY KEY,
      stage VARCHAR(30) NOT NULL,
      slot VARCHAR(30) NOT NULL,
      team_id VARCHAR(10) NOT NULL,
      was_shootout BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(stage, slot)
    )
  `;

  // Simple key/value store for tournament state.
  // Key "phase" controls pick locking:
  //   phase1_open | phase1_locked | phase2_open | phase2_locked | complete
  await sql`
    CREATE TABLE IF NOT EXISTS tournament_settings (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    INSERT INTO tournament_settings (key, value)
    VALUES ('phase', 'phase1_open')
    ON CONFLICT (key) DO NOTHING
  `;
}
