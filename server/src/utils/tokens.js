const crypto = require('crypto');
const { signAccess, verifyAccess, ACCESS_TTL_SEC } = require('./jwt');
const { query } = require('../db');

const REFRESH_TTL_SEC = +(process.env.REFRESH_TTL_SEC || 60 * 60 * 24 * 7); // 7 days

function randomToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function cookieBase() {
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    sameSite: (process.env.COOKIE_SAMESITE || 'lax'),
    secure: isProd,
    path: '/',
    domain
  };
}

async function createRefreshToken(userId, userAgent, ip) {
  const token = randomToken();
  const tokenHash = sha256(token);
  const expires = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip) VALUES ($1,$2,$3,$4,$5)`,
    [userId, tokenHash, expires, userAgent || null, ip || null]
  );
  return { token, expires };
}

async function rotateRefreshToken(oldToken, userId, userAgent, ip) {
  const oldHash = sha256(oldToken);
  const { rows } = await query(
    `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash=$1`,
    [oldHash]
  );
  if (rows.length === 0) throw new Error('Refresh token not found');
  const rec = rows[0];
  if (rec.user_id !== userId) throw new Error('Refresh token user mismatch');
  if (rec.revoked_at) throw new Error('Refresh token already used');
  if (new Date(rec.expires_at) < new Date()) throw new Error('Refresh token expired');

  // Revoke old
  await query(`UPDATE refresh_tokens SET revoked_at=NOW() WHERE id=$1`, [rec.id]);

  // Issue new
  return createRefreshToken(userId, userAgent, ip);
}

async function revokeRefreshToken(token) {
  if (!token) return;
  const hash = sha256(token);
  await query(`UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=$1`, [hash]);
}

function setSessionCookies(res, accessToken, accessExpires, refreshToken, refreshExpires) {
  const base = cookieBase();
  // Access token cookie (HttpOnly)
  res.cookie('at', accessToken, { ...base, maxAge: ACCESS_TTL_SEC * 1000 });
  // Refresh token cookie (HttpOnly, longer TTL)
  res.cookie('rt', refreshToken, { ...base, maxAge: REFRESH_TTL_SEC * 1000 });
}

function clearSessionCookies(res) {
  const base = cookieBase();
  res.clearCookie('at', { ...base });
  res.clearCookie('rt', { ...base });
}

function signAccessForUser(user) {
  return signAccess({ uid: user.id, email: user.email });
}

module.exports = {
  REFRESH_TTL_SEC,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  signAccessForUser,
  setSessionCookies,
  clearSessionCookies,
  verifyAccess
};
