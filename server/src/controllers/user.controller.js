const { query } = require('../db');

async function getMe(req, res) {
  return res.json({ ok: true, user: req.user });
}

async function updateMe(req, res) {
  const { full_name, locale, time_zone } = req.body || {};
  const { rows } = await query(
    `UPDATE users SET 
      full_name = COALESCE($1, full_name), 
      locale = COALESCE($2, locale),
      time_zone = COALESCE($3, time_zone),
      updated_at = NOW()
     WHERE id=$4
     RETURNING id, email, is_verified, created_at, updated_at, last_login_at, full_name, locale, time_zone`,
    [full_name ?? null, locale ?? null, time_zone ?? null, req.user.id]
  );
  return res.json({ ok: true, user: rows[0] });
}

module.exports = { getMe, updateMe };
