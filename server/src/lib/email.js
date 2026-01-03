// lib/email.js
const nodemailer = require("nodemailer");

const {
  MAIL_HOST = "smtps-proxy.fastmail.com", // Fastmail SMTP proxy host (works on DO via 443)
  MAIL_PORT = "443",                       // 443 = TLS from start
  MAIL_USER,
  MAIL_PASS,
  MAIL_FROM,                               // e.g., 'Gravizot <no-reply@gravizot.com>'
  MAIL_TO,                                 // e.g., 'greg@gravizot.com'
  APP_NAME = "gravizot-backend",
} = process.env;

if (!MAIL_HOST || !MAIL_PORT || !MAIL_USER || !MAIL_PASS || !MAIL_FROM || !MAIL_TO) {
  throw new Error("Missing required MAIL_* env vars. Check your .env.");
}

const PORT = Number(MAIL_PORT);
const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: PORT,                               // 443 (or 465); use 587 only with secure:false + STARTTLS
  secure: PORT === 465 || PORT === 443,     // TLS for 443/465; STARTTLS for 587
  auth: { user: MAIL_USER, pass: MAIL_PASS },
  connectionTimeout: 15_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

// simple HTML escape to avoid injection in the email body
function escapeHtml(input = "") {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * @param {{ email:string, topic:string, message:string, ip?:string, ua?:string }} payload
 */
async function sendContactEmail(payload) {
  const subject = `[Contact] ${payload.topic}`;

  const textBody = [
    `New contact submission from gravizot.com`,
    ``,
    `From: ${payload.email}`,
    `Topic: ${payload.topic}`,
    ``,
    `Message:`,
    payload.message,
    ``,
    `Meta:`,
    `IP: ${payload.ip ?? "n/a"}`,
    `User-Agent: ${payload.ua ?? "n/a"}`,
  ].join("\n");

  const htmlBody = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5">
      <p><strong>New contact submission from gravizot.com</strong></p>
      <p><strong>From:</strong> ${escapeHtml(payload.email)}<br/>
         <strong>Topic:</strong> ${escapeHtml(payload.topic)}</p>
      <p style="white-space:pre-wrap"><strong>Message:</strong><br/>${escapeHtml(payload.message)}</p>
      <hr/>
      <p style="color:#666"><strong>Meta</strong><br/>
         IP: ${escapeHtml(payload.ip ?? "n/a")}<br/>
         User-Agent: ${escapeHtml(payload.ua ?? "n/a")}</p>
      <p style="color:#999;font-size:12px">${escapeHtml(APP_NAME)}</p>
    </div>
  `;

  return transporter.sendMail({
    from: MAIL_FROM,
    to: MAIL_TO,
    replyTo: payload.email,  // so “Reply” goes to the visitor
    subject,
    text: textBody,
    html: htmlBody,
  });
}

module.exports = { sendContactEmail };
