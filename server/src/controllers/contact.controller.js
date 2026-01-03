// controllers/contact.controller.js
const { query } = require('../db');
const { contactSchema } = require('../validation/contact.schema');
const { sendContactEmail } = require('../utils/mailer');

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, s =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s])
  );
}

// remove control characters (defensive)
function stripControl(s = '') {
  return String(s).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
}

async function postContact(req, res, next) {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; ');
      return res.status(400).json({ ok: false, error: msg });
    }

    // Prefer validated fields, but gracefully accept legacy {details}
    const { topic, email, message } = parsed.data;
    const normalizedMessage =
      (typeof message === 'string' && message.trim())
        ? message
        : (typeof req.body?.details === 'string' ? req.body.details : '');

    if (!normalizedMessage || !String(normalizedMessage).trim()) {
      return res.status(400).json({ ok: false, error: 'Message is required' });
    }

    // Proxy-aware IP (requires app.set('trust proxy', 1) when behind nginx)
    const xff = req.headers['x-forwarded-for'];
    const ipFromProxy = Array.isArray(xff) ? xff[0] : (xff || '');
    const ip =
      (ipFromProxy.split(',')[0] || '').trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;

    const ua = req.get('user-agent') || null;

    // Sanitize for storage / email body
    const safeTopic = stripControl(topic);
    const safeEmail = String(email).trim();
    const safeMessage = stripControl(normalizedMessage);

    // Insert first so we can include id/timestamp in the email
    const sql = `INSERT INTO contact_messages (topic, email, message, ip, ua)
                 VALUES ($1,$2,$3,$4,$5)
                 RETURNING id, created_at`;
    const { rows } = await query(sql, [safeTopic, safeEmail, safeMessage, ip, ua]);
    const { id, created_at } = rows[0];

    let emailResult = null;
    const enableEmail = (process.env.gravizot_enable_email ?? 'true') !== 'false';
    if (enableEmail) {
      // Support either your gravizot_* envs or MAIL_* fallbacks
      const to =
        process.env.gravizot_contact_to ||
        process.env.MAIL_TO ||
        process.env.gravizot_smtp_user;

      // Recommend a domain address you control for From (aligns with DMARC)
      const from =
        process.env.gravizot_contact_from ||
        process.env.MAIL_FROM ||
        process.env.gravizot_smtp_user;

      const prefix = process.env.gravizot_contact_subject_prefix || '[Contact]';
      const site = process.env.gravizot_site_name || 'Website';

      const subject = `${prefix} ${site}: ${safeTopic}`;
      const atIso = new Date(created_at).toISOString();

      const text = `New contact message (#${id})
Site: ${site}
Topic: ${safeTopic}
From: ${safeEmail}
IP: ${ip || 'n/a'}
UA: ${ua || 'n/a'}
At: ${atIso}

Message:
${safeMessage}
`;

      const html = `<p><strong>New contact message (#${id})</strong></p>
<p><b>Site:</b> ${escapeHtml(site)}<br/>
<b>Topic:</b> ${escapeHtml(safeTopic)}<br/>
<b>From:</b> ${escapeHtml(safeEmail)}<br/>
<b>IP:</b> ${escapeHtml(ip || 'n/a')}<br/>
<b>UA:</b> ${escapeHtml(ua || 'n/a')}<br/>
<b>At:</b> ${escapeHtml(atIso)}</p>
<pre style="white-space:pre-wrap;font-family:monospace">${escapeHtml(safeMessage)}</pre>`;

      try {
        // If your mailer forwards options to Nodemailer, replyTo will be honored.
        emailResult = await sendContactEmail({
          to,
          from,
          subject,
          text,
          html,
          replyTo: safeEmail, // let “Reply” go to the visitor
          headers: {
            'X-Source-App': process.env.APP_NAME || 'gravizot-backend',
          },
        });
      } catch (e) {
        console.error('[contact email error]', e);
      }
    }

    return res.status(201).json({
      ok: true,
      id,
      created_at,
      email_sent: Boolean(emailResult),
    });
  } catch (err) {
    next(err);
  }
}

// Simple GET to plant/refresh CSRF cookie (your server plants CSRF on every GET)
async function getCsrf(req, res) {
  return res.json({ ok: true, csrf: 'planted' });
}

module.exports = { postContact, getCsrf };
