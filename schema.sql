CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  session_token VARCHAR(64) UNIQUE NOT NULL,
  is_kid BOOLEAN DEFAULT false,
  chargeup_active BOOLEAN DEFAULT false,   -- kid power: champion bonus ×2
  heart_pick_team_id VARCHAR(10),          -- kid power: +1 per win for this team
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS picks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  stage VARCHAR(30) NOT NULL,   -- group | runner | third | fourth | r32 | r16 | qf | sf | final | champion
  slot VARCHAR(30) NOT NULL,    -- group letter (A–L) or match id (m1, m2…)
  team_id VARCHAR(10) NOT NULL,
  is_star_power BOOLEAN DEFAULT false,  -- kid power: doubles points for this pick if correct
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, stage, slot)
);

-- Actual tournament outcomes entered by admin.
-- stage/slot mirrors the picks table convention.
-- was_shootout enables the shootout mercy rule (half points for loser pick).
CREATE TABLE IF NOT EXISTS results (
  id SERIAL PRIMARY KEY,
  stage VARCHAR(30) NOT NULL,
  slot VARCHAR(30) NOT NULL,
  team_id VARCHAR(10) NOT NULL,
  was_shootout BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(stage, slot)
);

-- Simple key/value store for tournament state.
-- Key "phase" controls pick locking:
--   phase1_open | phase1_locked | phase2_open | phase2_locked | complete
CREATE TABLE IF NOT EXISTS tournament_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
