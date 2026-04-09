import pg from 'pg';

const { Pool } = pg;

export const dbEnabled = Boolean(process.env.DATABASE_URL);

if (!dbEnabled) {
  console.warn('DATABASE_URL is not set. Running in local mode without database-backed auth/saves.');
}

const pool = dbEnabled
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : {
      query: async () => {
        throw new Error('Database is disabled (DATABASE_URL not set).');
      }
    };

export async function initDb() {
  if (!dbEnabled) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS saved_games (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      game_data JSONB NOT NULL,
      saved_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export default pool;
