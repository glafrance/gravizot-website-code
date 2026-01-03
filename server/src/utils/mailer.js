// utils/mailer.js (CommonJS)
const nodemailer = require('nodemailer');

// Prefer MAIL_*; fall back to legacy gravizot_smtp_* so older envs still work
const HOST = process.env.MAIL_HOST || process.env.gravizot_smtp_host || 'smtps-proxy.fastmail.com';
const PORT = Number(process.env.MAIL_PORT || process.env.gravizot_smtp_port || '443');
const USER = process.env.MAIL_USER || process.env.gravizot_smtp_user; // e.g., greg@gravizot.com
const PASS = process.env.MAIL_PASS || process.env.gravizot_smtp_pass; // Fastmail app password
const FROM = process.env.MAIL_FROM || process.env.gravizot_contact_from || USER;

if (!USER || !PASS) {
  throw new Error(
    'Missing SMTP env (MAIL_USER/MAIL_PASS or gravizot_smtp_user/gravizot_smtp_pass)'
  );
}

const SECURE = PORT === 443 || PORT === 465; // TLS-from-start on 443/465; STARTTLS if 587

// Helpful one-time boot log (no secrets)
console.log('[mailer]', {
  host: HOST,
  port: PORT,
  secure: SECURE,
  user: USER,
});

const transporter = nodemailer.createTransport({
  host: HOST,
  port: PORT,
  secure: SECURE,
  auth: { user: USER, pass: PASS },
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  // logger: true, debug: true, // uncomment if you need wire logs
});

/**
 * Send an email.
 * @param {{to:string, from?:string, subject:string, text?:string, html?:string, replyTo?:string, headers?:Record<string,string>}} opts
 */
async function sendContactEmail(opts) {
  const { to, from = FROM, subject, text, html, replyTo, headers } = opts || {};
  if (!to || !subject || (!text && !html)) {
    throw new Error('sendContactEmail requires {to, subject, text|html}');
  }
  return transporter.sendMail({ to, from, subject, text, html, replyTo, headers });
}

module.exports = { sendContactEmail };
