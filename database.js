import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
export const dbEnabled = Boolean(connectionString);

if (!dbEnabled) {
  console.warn('DATABASE_URL is not set. Running in local mode without database-backed auth/saves.');
}

const isLocalConnection = typeof connectionString === 'string'
  && /(localhost|127\.0\.0\.1)/i.test(connectionString);
const dbSslSetting = process.env.DB_SSL;
const useSsl = dbSslSetting === 'true' || (dbSslSetting !== 'false' && !isLocalConnection);

const pool = dbEnabled
  ? new Pool({
      connectionString,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {})
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
