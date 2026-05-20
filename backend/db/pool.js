const { Pool } = require('pg');

const useSsl = String(process.env.PGSSL || '').toLowerCase() === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => console.log('[db] PostgreSQL connected'));
pool.on('error', (err) => console.error('[db] pool error:', err.message));

module.exports = pool;
