# Contact Messages Endpoint Add‑On

This package adds a secure **POST `/api/contact`** endpoint to accept “Contact Us” submissions, store them in Postgres, and (optionally) email you a notification. It uses **Zod** for input validation and **Nodemailer** for email. It also includes an **SQL migration** and a tiny migration runner.

> Works with your existing Express + Postgres starter (CommonJS). It integrates cleanly with your existing CSRF setup and CORS policy.

---

## 1) Install dependencies

```bash
npm i zod nodemailer hpp
# Optional (structured logging):
npm i pino pino-http
```

(You already have `helmet` in your project.)

---

## 2) Add the new files

Copy the `src/` and `db/` folders from this zip into your backend repo root. They align with your existing layout:
- Your server imports routers from `./src/routes/*` (see your `server.js`). fileciteturn0file1
- Controllers use `../db` to run queries (see `user.controller.js`). fileciteturn0file2
- The pg connection is provided by `db.js` and looks up `DATABASE_URL`. fileciteturn0file3
- Existing user routes are in `src/routes/user.routes.js`. Our contact endpoint is a separate router. fileciteturn0file4

**New files included:**
- `src/validation/contact.schema.js` — Zod schema
- `src/utils/mailer.js` — Nodemailer helper
- `src/controllers/contact.controller.js` — Inserts to DB and sends email
- `src/routes/contact.routes.js` — `POST /api/contact` and `GET /api/contact/csrf`
- `db/sql/001_create_contact_messages.sql` — migration
- `db/migrate.js` — mini migration runner
- `.env.contact.example` — example environment vars

---

## 3) Wire the router + hardening middleware

Open your `server.js` and make these changes:

```js
// --- add near the top ---
const hpp = require('hpp');
const contactRoutes = require('./src/routes/contact.routes');
const { requireCsrfForMutations } = require('./src/middleware/csrf');
// Optional (switch from morgan):
// const pino = require('pino')({ level: process.env.PINO_LEVEL || 'info' });
// const pinoHttp = require('pino-http')({ logger: pino, redact: ['req.headers.authorization', 'res.headers["set-cookie"]'] });

// --- after app = express() and before routes ---
app.use(hpp({ checkBody: true, checkQuery: true }));
// app.use(pinoHttp); // uncomment if you decide to use pino-http instead of morgan

// --- where routes are mounted ---
app.use('/api/contact', requireCsrfForMutations, contactRoutes);

```

Why this?
- `hpp` blocks HTTP parameter pollution.
- We mount `'/api/contact'` **with** your `requireCsrfForMutations` so POSTs require a valid CSRF token (your server already plants/refreshes a CSRF cookie on every GET). fileciteturn0file1
- If you want JSON structured logs instead of `morgan`, uncomment the `pino-http` lines and remove `morgan` (or keep both during transition).

> **Tip:** If you prefer to put contact under the users router, add `router.post('/contact', postContact)` inside `src/routes/user.routes.js` and keep CSRF protection on the whole `/api/users` subtree (as it already is). fileciteturn0file4

---

## 4) Environment variables

Copy and adapt `.env.contact.example` to your real `.env` (the path is already loaded by your `server.js`). fileciteturn0file1

```ini
# === Contact Email (Gmail/Google Workspace over SMTP) ===
gravizot_smtp_host=smtp.gmail.com
gravizot_smtp_port=465
gravizot_smtp_user=yourname@yourdomain.com
gravizot_smtp_pass=your_app_password_here

# Who receives/appears on the contact notification
gravizot_contact_to=yourname@yourdomain.com
gravizot_contact_from="ByteZoggle Contact <yourname@yourdomain.com>"
gravizot_contact_subject_prefix=[Contact]
gravizot_site_name=ByteZoggle
gravizot_enable_email=true

```

- Use a **Google Workspace App Password** for `gravizot_smtp_pass` (or your SMTP provider’s secret).
- Set `gravizot_enable_email=false` to temporarily suppress emails while still storing the message.

---

## 5) Create the database table

Run the included migration (uses your existing `DATABASE_URL`; see `db.js`). fileciteturn0file3

```bash
node db/migrate.js
# or if you add this script to package.json:
#   "db:migrate": "node db/migrate.js"
npm run db:migrate
```

This creates a **`contact_messages`** table with:
- `topic, email, message, ip, ua, created_at`

> The migration runner also creates a `migrations` table and only runs each `*.sql` file once.

---

## 6) Client‑side flow (CSRF)

Your server plants a CSRF cookie on all **GET** requests before routes. fileciteturn0file1  
So from your front‑end:

1. `GET /api/contact/csrf` (no payload) → sets/refreshes CSRF cookie.
2. `POST /api/contact` with header `x-csrf-token: <token>` and body:
   ```json
   {"topic":"General","email":"person@example.com","message":"Hello!"}
   ```

> If your CSRF middleware expects the token from a cookie or a header, keep using the same mechanism you use for `/api/auth` and `/api/users`. fileciteturn0file1

---

## 7) The endpoint

- **POST `/api/contact`** → validates with Zod, stores in DB, then sends you an email (if enabled). Response:
  ```json
  {"ok":true,"id":123,"created_at":"2025-09-30T20:00:00.000Z","email_sent":true}
  ```
- **GET `/api/contact/csrf`** → simple JSON `{ok:true}` to conveniently plant the CSRF cookie.

---

## 8) Should you add those packages?

- **zod** ✅ Yes — reliable server‑side validation/sanitization.
- **nodemailer** ✅ Yes — portable SMTP notifications.
- **helmet** ✅ You already have it; keep it. fileciteturn0file1
- **hpp** ✅ Add — closes a common input attack vector quickly.
- **pino + pino-http** ✅ Recommended — structured logs; optional if you’re happy with morgan.
- **(Bonus)** Consider a lightweight rate limiter later to cut down spam bursts.

---

## 9) Database notes

DB access uses your existing `query()` helper from `db.js`. Transactions aren't necessary here, since it’s a single insert and email is best‑effort after commit. fileciteturn0file3

---

## 10) Test quickly with cURL

```bash
# 1) Plant CSRF cookie (will be set; use -c/-b to persist cookies locally)
curl -i -c cookies.txt http://localhost:3001/api/contact/csrf

# 2) Send a contact message (replace TOKEN with your CSRF token if required)
curl -i -b cookies.txt -H "content-type: application/json" -H "x-csrf-token: TOKEN" \  -d '{{ 
    "topic":"Demo",
    "email":"sender@example.com",
    "message":"Just saying hi — this is a test message."
  }}' \  http://localhost:3001/api/contact
```

---

## 11) Troubleshooting

- **400 with validation error** → Check `topic/email/message` lengths/format (see Zod schema).
- **201 but `email_sent:false`** → SMTP env values missing or SMTP blocked. The message **still** saved.
- **CORS preflight blocks** → Your CORS middleware is already configured to allow `content-type` and `x-csrf-token`. fileciteturn0file1
- **`DATABASE_URL` missing** → Your `db.js` requires it (throws). fileciteturn0file3

---

Happy shipping!
