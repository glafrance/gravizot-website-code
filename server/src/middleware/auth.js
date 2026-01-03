const { verifyAccess } = require('../utils/jwt');
const { query } = require('../db');

async function requireAuth(req, res, next) {
  const token = req.cookies?.at;
  if (!token) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  const payload = verifyAccess(token);
  if (!payload) return res.status(401).json({ ok: false, error: 'Invalid token' });
  const { rows } = await query(
    'SELECT id, email, is_verified, created_at, updated_at, last_login_at FROM users WHERE id=$1',
    [payload.uid]
  );
  if (rows.length === 0) return res.status(401).json({ ok: false, error: 'User not found' });
  req.user = rows[0];
  next();
}

module.exports = { requireAuth };
