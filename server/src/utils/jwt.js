// Kept for backwards compatibility if you still want a stateless-only cookie.
// Not used for refresh rotation (see utils/tokens.js).
const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret';
const ACCESS_TTL_SEC = +(process.env.ACCESS_TTL_SEC || 15 * 60); // 15 minutes

function signAccess(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL_SEC });
}

function verifyAccess(token) {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = { signAccess, verifyAccess, ACCESS_TTL_SEC };
