const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Optional: SSL in production if using managed Postgres
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log('db', { text: text.split('\n')[0].slice(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

module.exports = { pool, query };
