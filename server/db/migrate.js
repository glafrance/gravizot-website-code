#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_PATH || '../../secrets/gravizot-website/.env' });
const { query } = require('../src/db');

(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id BIGSERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const dir = path.join(__dirname, 'sql');
    const files = fs.readdirSync(dir)
      .filter(f => /^\d+_.*\.sql$/.test(f))
      .sort();

    for (const file of files) {
      const seen = await query('SELECT 1 FROM migrations WHERE name=$1', [file]);
      if (seen.rows.length) {
        console.log('skip', file);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log('running', file);
      await query(sql);
      await query('INSERT INTO migrations (name) VALUES ($1)', [file]);
    }
    console.log('Migrations complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
})();
