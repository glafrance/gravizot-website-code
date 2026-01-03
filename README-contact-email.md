# Gravizot Contact Email: Node.js/Express + Fastmail (SMTP)

This guide walks you through wiring your **Contact Us** API endpoint so that each submission sends
an email to **greg@gravizot.com** via **Fastmail SMTP**, and (optionally) stores the message in Postgres.
It’s written for your stack: **Ubuntu 22.04, nginx, Node.js/Express, Postgres, Let’s Encrypt** on a
DigitalOcean droplet, with **DNS at DigitalOcean** and **Fastmail** for email.

> TL;DR: Use `nodemailer` with Fastmail’s SMTP, validate inputs with `zod`, rate‑limit the endpoint,
> and set `replyTo` to the submitter’s email while sending **from** a domain address you control
> (e.g., `no-reply@gravizot.com`) to preserve deliverability with SPF/DKIM/DMARC.


---

## 1) Prereqs & Deliverability

1. **Fastmail SMTP app password**
   - In Fastmail, create an **app password** for SMTP (don’t use your main login password).
   - You’ll authenticate with your full Fastmail login (e.g., `greg@gravizot.com`) + that app password.

2. **DNS records (at DigitalOcean)**
   - **MX**: already pointed to Fastmail.
   - **SPF**: Add/confirm a TXT record like:
     ```
     v=spf1 include:spf.messagingengine.com ~all
     ```
     > You can tighten `~all` to `-all` after you’re certain all legitimate senders are covered.
   - **DKIM**: Fastmail provides 2–3 DKIM selectors (e.g., `fm1`, `fm2`, `fm3`). Add the TXT records
     they show you (names like `fm1._domainkey.gravizot.com`).
   - **DMARC** (recommended):
     ```
     v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@gravizot.com; ruf=mailto:dmarc@gravizot.com; adkim=s; aspf=s
     ```
     > Start with `p=quarantine` and move to `p=reject` when you’re confident. Create the `dmarc@` mailbox or alias.

3. **Outbound email ports on DigitalOcean**
   - Use **SMTP over TLS/SSL 465** or **STARTTLS 587**. DO commonly blocks port 25; 465/587 are fine.


---

## 2) Packages to Install

From your backend project root:

```bash
pnpm add nodemailer zod express-rate-limit validator
# or: npm i nodemailer zod express-rate-limit validator
```

- `nodemailer` — SMTP client
- `zod` — request validation
- `express-rate-limit` — protects against abuse
- `validator` — extra string checks/sanitization


---

## 3) Environment Variables

Create/update **.env** (and your production secret manager) with:

```bash
# Email (Fastmail)
MAIL_HOST=smtp.fastmail.com
MAIL_PORT=465            # 465 for SSL/TLS, 587 for STARTTLS
MAIL_SECURE=true         # true for 465; false for 587 with STARTTLS
MAIL_USER=greg@gravizot.com          # your Fastmail login
MAIL_PASS=YOUR_FASTMAIL_APP_PASSWORD # never commit this
MAIL_FROM="Gravizot <no-reply@gravizot.com>"  # envelope From you control
MAIL_TO=greg@gravizot.com             # destination for Contact Us messages

# Optional: app name for headers/logging
APP_NAME=gravizot-backend
```

> **Why `MAIL_FROM` not the visitor’s email?** Sending “From” the visitor can break SPF/DMARC.
> Instead, set **`replyTo`** to the visitor so your email client’s “Reply” goes to them.


---

## 4) Email Helper (`src/lib/email.ts`)

```ts
// src/lib/email.ts
import nodemailer from "nodemailer";

const {
  MAIL_HOST,
  MAIL_PORT,
  MAIL_SECURE,
  MAIL_USER,
  MAIL_PASS,
  MAIL_FROM,
  MAIL_TO,
  APP_NAME,
} = process.env;

if (!MAIL_HOST || !MAIL_PORT || !MAIL_USER || !MAIL_PASS || !MAIL_FROM || !MAIL_TO) {
  throw new Error("Missing required MAIL_* env vars. Check your .env.");
}

const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: Number(MAIL_PORT),
  secure: MAIL_SECURE === "true", // true for 465, false for 587 + STARTTLS
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS,
  },
  // Good practice: timeouts
  connectionTimeout: 15_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

export type ContactPayload = {
  email: string;
  topic: string;
  message: string;
  ip?: string;
  userAgent?: string;
};

export async function sendContactEmail(payload: ContactPayload) {
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
    `User-Agent: ${payload.userAgent ?? "n/a"}`,
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
         User-Agent: ${escapeHtml(payload.userAgent ?? "n/a")}</p>
      <p style="color:#999;font-size:12px">${escapeHtml(APP_NAME ?? "gravizot-backend")}</p>
    </div>
  `;

  return transporter.sendMail({
    from: MAIL_FROM,
    to: MAIL_TO,
    replyTo: payload.email, // so "Reply" goes to the visitor
    subject,
    text: textBody,
    html: htmlBody,
  });
}

// minimal escaping for HTML body
function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```


---

## 5) Contact Route (`src/routes/contact.ts`)

Accept **either** `message` **or** `details` (to match your earlier payloads). Validate with `zod`,
apply rate‑limiting, and call `sendContactEmail`. Optionally, insert into Postgres.

```ts
// src/routes/contact.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import validator from "validator";
import type { Request, Response } from "express";
import { sendContactEmail } from "../lib/email";

// Optional: Postgres (if you want to persist submissions)
import { Pool } from "pg";
const pool = new Pool({
  // use DATABASE_URL or pg config env vars already set in your app
});

const contactLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 8,              // allow a few retries
  standardHeaders: true,
  legacyHeaders: false,
});

const RawSchema = z.object({
  email: z.string().trim().email(),
  topic: z.string().trim().min(1, "Topic is required").max(200),
  message: z.string().trim().min(1).optional(),
  details: z.string().trim().min(1).optional(),
});

// Normalize: use "message" as canonical field
const ContactSchema = RawSchema.superRefine((val, ctx) => {
  if (!val.message && !val.details) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Message is required" });
  }
});

export const contactRouter = Router();

contactRouter.get("/csrf", (req: Request, res: Response) => {
  // If you already have CSRF middleware, keep using it. This is a placeholder.
  res.json({ ok: true, csrf: "planted" });
});

contactRouter.post("/", contactLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = ContactSchema.parse(req.body);
    const message = parsed.message ?? parsed.details ?? "";

    // Extra safety: strip unseen control chars; disallow dangerous inputs
    const safeEmail = parsed.email;
    const safeTopic = validator.blacklist(parsed.topic, "\\p{C}").trim();
    const safeMessage = validator.blacklist(message, "\\p{C}").trim();

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? req.socket.remoteAddress ?? undefined;
    const userAgent = req.headers["user-agent"];

    // 1) Send the email (await to surface deliverability errors to the client)
    await sendContactEmail({
      email: safeEmail,
      topic: safeTopic,
      message: safeMessage,
      ip,
      userAgent,
    });

    // 2) Optional: persist to Postgres
    //    Make sure your table/columns exist and names match (message vs details).
    //    Example schema: contact_messages(id serial pk, email text, topic text, message text, ip text, user_agent text, created_at timestamptz default now())
    try {
      await pool.query(
        `INSERT INTO contact_messages(email, topic, message, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`,
        [safeEmail, safeTopic, safeMessage, ip ?? null, userAgent ?? null]
      );
    } catch (dbErr) {
      // Log only; don't fail the whole request if email already succeeded
      console.error("[contact] DB insert failed:", dbErr);
    }

    res.json({ ok: true });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ ok: false, error: err.errors?.[0]?.message ?? "Invalid input" });
    }
    console.error("[contact] Error:", err);
    res.status(500).json({ ok: false, error: "Failed to send message" });
  }
});
```

**Mount the router** (e.g., in `src/server.ts`):

```ts
import express from "express";
import cors from "cors";
import { contactRouter } from "./routes/contact";

const app = express();
app.use(express.json());

// Use your existing CORS middleware (credentials, allowed origins, headers, etc.)
// Example (you already have a stricter version in your app):
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const allowed = [
      "http://localhost:4200",
      "http://127.0.0.1:4200",
      "https://gravizot.com",
      "https://www.gravizot.com",
    ];
    cb(allowed.includes(origin) ? null : new Error("Blocked by CORS"), allowed.includes(origin));
  },
  credentials: true,
}));

app.use("/api/contact", contactRouter);

app.listen(process.env.PORT ?? 3001, () => {
  console.log("API listening on", process.env.PORT ?? 3001);
});
```


---

## 6) Postgres Schema & Migration Note

If your prior table used `message` but the frontend sent `details` (or vice‑versa), pick **one** canonical name.
This README uses **`message`** in code and maps `details` → `message` for backward compatibility.

Example migration to rename `message` → `details` (or the reverse) if you decide the other way:

```sql
-- 003_contact_messages_rename.sql
ALTER TABLE contact_messages
  RENAME COLUMN message TO details;
```

Or create both columns temporarily and backfill. Keep your app schema in sync.


---

## 7) Testing

### 7.1 Curl
```bash
curl -X POST https://gravizot.com/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.sender@example.com",
    "topic": "Just testing the contact form",
    "message": "Hoping this message makes its way through."
  }'
```

Expected response:
```json
{ "ok": true }
```

### 7.2 Postman
- POST to `https://gravizot.com/api/contact`
- Body → raw → JSON:
  ```json
  {
    "email": "test.sender@example.com",
    "topic": "Hello from Postman",
    "message": "It works!"
  }
  ```
- Verify the email arrives at **greg@gravizot.com**. Check **Spam/Promotions** if not.


---

## 8) Production Tips

- **From/ReplyTo**: Keep `from: "Gravizot <no-reply@gravizot.com>"` and `replyTo: visitor@their-domain.com`.
- **Rate limit**: Already added; tune `max`/`windowMs` for your traffic.
- **CSRF**: For cookie‑based UIs, continue using your CSRF guard. For pure XHR + JSON, consider keeping GET `/csrf` or using double‑submit tokens.
- **Do not block on DB**: Email success is primary; DB insert failure should not fail the whole request.
- **Logging**: Add `pino` or `pino-http` for structured logs with redaction of secrets.
- **Queue (optional)**: If email latency matters, enqueue and acknowledge immediately, but for now awaiting the SMTP call is simpler.
- **TLS**: Stick to 465 (secure) or 587 (STARTTLS). Avoid port 25.
- **SPF/DKIM/DMARC**: Allow some time (TTL) for DNS to propagate. Use DMARC reports (`rua`) to monitor.


---

## 9) Common Errors & Fixes

- **`Invalid login`**: Verify `MAIL_USER` (full address) and `MAIL_PASS` (Fastmail app password).
- **`ETIMEDOUT` / `ECONNECTION`**: Check firewall/ufw, confirm outbound 465/587 allowed; verify `MAIL_HOST` and port.
- **`550 5.7.26` or DMARC/SPF failures**: Make sure you’re not sending `From: visitor@example.com`. Use your domain in `From` and the visitor in `replyTo`.
- **Arrives in Spam**: Ensure SPF/DKIM/DMARC all pass; warm up sending, avoid “spammy” subjects, keep HTML simple.


---

## 10) Minimal Frontend Payload (Angular)

Send **one** of these payloads (both are accepted by the backend):

```ts
// Preferred:
{ email: string; topic: string; message: string; }

// Back-compat (still works):
{ email: string; topic: string; details: string; }
```


---

## 11) Quick Checklist

- [ ] Fastmail app password created
- [ ] `.env` MAIL_* set (no secrets committed)
- [ ] SPF includes `spf.messagingengine.com`
- [ ] DKIM selectors (fm1/fm2/fm3) added
- [ ] DMARC policy published
- [ ] Contact route deployed and working
- [ ] Test email arrives; Reply goes to visitor
- [ ] Rate limit in place; logs clean

You’re set. New contact messages will email **greg@gravizot.com** reliably via Fastmail.
