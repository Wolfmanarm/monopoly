import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

function getConnectionInfo() {
  const defaultUrl = 'postgres://localhost:5432/monopoly_dev';
  const appUrl = process.env.DATABASE_URL || defaultUrl;
  const parsed = new URL(appUrl);
  const dbName = parsed.pathname.replace(/^\//, '') || 'monopoly_dev';

  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`Invalid database name: "${dbName}". Use only letters, numbers, and underscores.`);
  }

  const adminUrl = new URL(appUrl);
  adminUrl.pathname = '/postgres';

  const isLocal = /(localhost|127\.0\.0\.1)/i.test(parsed.hostname || '');
  const dbSslSetting = process.env.DB_SSL;
  const useSsl = dbSslSetting === 'true' || (dbSslSetting !== 'false' && !isLocal);

  return {
    dbName,
    adminConnectionString: adminUrl.toString(),
    useSsl
  };
}

async function ensureDatabaseExists() {
  const { dbName, adminConnectionString, useSsl } = getConnectionInfo();
  const client = new Client({
    connectionString: adminConnectionString,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {})
  });

  await client.connect();
  try {
    const checkResult = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (checkResult.rowCount > 0) {
      console.log(`Database "${dbName}" already exists.`);
      return;
    }

    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database "${dbName}" created.`);
  } finally {
    await client.end();
  }
}

ensureDatabaseExists().catch((error) => {
  if (String(error.message).includes('client password must be a string')) {
    console.error('Failed to create local database: missing PostgreSQL password.');
    console.error('Set DATABASE_URL in .env to include credentials, for example:');
    console.error('DATABASE_URL=postgres://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/monopoly_dev');
    process.exit(1);
  }
  console.error('Failed to create local database:', error.message);
  process.exit(1);
});