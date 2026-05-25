'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function seed() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'colony',
    user: process.env.DB_USER || 'colony_user',
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10000,
  });

  try {
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL');

    const hash = await bcrypt.hash('admin123', 12);

    await pool.query(
      `INSERT INTO admin_users (username, password_hash, email, role, permissions)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           permissions = EXCLUDED.permissions`,
      ['admin', hash, 'admin@colony.app', 'super_admin', JSON.stringify({ '*': true })]
    );

    console.log('Admin user seeded: admin / admin123');
    console.log('Role: super_admin, Permissions: * (full access)');
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
