// server/src/middleware/csrf.js
const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';
const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase(); // 'lax' recommended
const domain = process.env.COOKIE_DOMAIN || 'localhost';

// read a cookie safely
function readCookie(req, name) {
  return req.cookies ? req.cookies[name] : undefined;
}

// set/refresh the csrfToken cookie
function setCsrfCookie(res) {
  const token = crypto.randomBytes(24).toString('base64url');
  res.cookie('csrfToken', token, {
    httpOnly: false,         // MUST be readable by frontend to echo back in header
    secure: isProd,          // true on HTTPS in production
    sameSite,                // 'lax' is good for SPA on same-site dev ports
    domain,                  // set to your real domain in prod (e.g. '.example.com')
    path: '/',
    maxAge: 60 * 60 * 1000,  // 1 hour
  });
  return token;
}

/**
 * Plant CSRF on every safe request so the client always has a fresh token.
 * (Order: must run BEFORE any routes)
 */
function ensureCsrfCookie(req, res, next) {
  if (/^(GET|HEAD|OPTIONS)$/i.test(req.method)) {
    if (!readCookie(req, 'csrfToken')) setCsrfCookie(res);
    return next();
  }
  return next();
}

/**
 * Validate double-submit CSRF on mutations (POST/PUT/PATCH/DELETE).
 * If valid, optionally rotate the token.
 */
function requireCsrfForMutations(req, res, next) {
  if (/^(GET|HEAD|OPTIONS)$/i.test(req.method)) return next();
  const header = req.get('X-CSRF-Token');         // frontend sends this (credentialsInterceptor)
  const cookie = readCookie(req, 'csrfToken');    // we planted this on last GET
  if (!cookie || !header || header !== cookie) {
    return res.status(403).json({ ok: false, error: 'Bad CSRF token' });
  }
  // Rotate token after a successful mutation to limit reuse
  setCsrfCookie(res);
  next();
}

module.exports = { ensureCsrfCookie, requireCsrfForMutations };
