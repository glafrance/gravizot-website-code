const bcrypt = require('bcryptjs');
const { query } = require('../db');
const {
  signAccessForUser,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  setSessionCookies,
  clearSessionCookies
} = require('../utils/tokens');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function cookieOptionsInfo() {
  return {
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    secure: process.env.NODE_ENV === 'production',
    domain: process.env.COOKIE_DOMAIN || undefined
  };
}

async function signup(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required' });
    const { rows: exists } = await query('SELECT 1 FROM users WHERE email=$1', [email]);
    if (exists.length > 0) return res.status(409).json({ ok: false, error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email, is_verified, created_at, updated_at, last_login_at',
      [email, hash]
    );
    const user = rows[0];

    const access = signAccessForUser(user);
    const { token: refresh, expires: rtExp } = await createRefreshToken(user.id, req.get('user-agent'), req.ip);

    setSessionCookies(res, access, null, refresh, rtExp);

    res.status(201).json({ ok: true, user, cookies: cookieOptionsInfo() });
  } catch (e) {
    console.error('[signup]', e);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}

async function login(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const { rows } = await query('SELECT id, email, password_hash, is_verified, created_at, updated_at, last_login_at FROM users WHERE email=$1', [email]);
    if (rows.length === 0) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    await query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [user.id]);

    const access = signAccessForUser(user);
    const { token: refresh, expires: rtExp } = await createRefreshToken(user.id, req.get('user-agent'), req.ip);

    setSessionCookies(res, access, null, refresh, rtExp);
    delete user.password_hash;
    res.json({ ok: true, user, cookies: cookieOptionsInfo() });
  } catch (e) {
    console.error('[login]', e);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}

async function logout(req, res) {
  try {
    const refresh = req.cookies?.rt;
    await revokeRefreshToken(refresh);
    clearSessionCookies(res);
    res.json({ ok: true });
  } catch (e) {
    clearSessionCookies(res);
    res.json({ ok: true });
  }
}

async function refresh(req, res) {
  try {
    const old = req.cookies?.rt;
    if (!old) return res.status(401).json({ ok: false, error: 'No refresh token' });
    // Read user id from access token if present; otherwise, parse from DB by matching refresh
    // For simplicity, fetch token record join user
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(old).digest('hex');
    const { rows } = await query(
      `SELECT rt.user_id, u.email FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id WHERE rt.token_hash=$1`,
      [hash]
    );
    if (rows.length === 0) return res.status(401).json({ ok: false, error: 'Invalid refresh' });
    const userId = rows[0].user_id;

    const { token: newRefresh, expires: rtExp } = await rotateRefreshToken(old, userId, req.get('user-agent'), req.ip);
    // Sign new access
    const access = signAccessForUser({ id: userId, email: rows[0].email });

    setSessionCookies(res, access, null, newRefresh, rtExp);
    res.json({ ok: true });
  } catch (e) {
    console.error('[refresh]', e);
    res.status(401).json({ ok: false, error: 'Refresh failed' });
  }
}

async function me(req, res) {
  try {
    // requireAuth should have set req.user
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { rows } = await query(
      'SELECT id, email, is_verified, created_at, updated_at, last_login_at FROM users WHERE id=$1',
      [uid]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'User not found' });

    // Return a plain user object (what your Angular bootstrap expects)
    return res.json(rows[0]);
  } catch (e) {
    console.error('[me]', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

module.exports = { signup, login, logout, refresh, me };
