// server/server.js
require('dotenv').config({ path: process.env.DOTENV_PATH || '../../secrets/gravizot-website/.env' });
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const pino = require('pino')({ level: process.env.PINO_LEVEL || 'info' });
const pinoHttp = require('pino-http')({ logger: pino, redact: ['req.headers.authorization', 'res.headers["set-cookie"]'] });

const hpp = require('hpp');
const contactRoutes = require('./src/routes/contact.routes');

const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');
const { ensureCsrfCookie, requireCsrfForMutations } = require('./src/middleware/csrf');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

/* ------------------------- CORS (allow cookies) ------------------------- */
const tenantOrigins = JSON.parse(process.env.CORS_TENANT_ORIGINS_JSON || '{}');
const tenantOriginList = Object.values(tenantOrigins).flat(); // flatten arrays of tenant domains

const rawAllowed =
  process.env.ALLOWED_ORIGINS ||
  process.env.CORS_DEFAULT_ALLOWLIST ||
  'http://localhost:4200,http://localhost:5173,http://localhost:8787';

const allowedOrigins = [
  ...rawAllowed.split(',').map(s => s.trim()),
  ...tenantOriginList,
].filter(Boolean);

const baseHeaders = (process.env.CORS_ALLOW_HEADERS || 'authorization,content-type,x-requested-with,x-admin-key')
  .split(',')
  .map(h => h.trim().toLowerCase())
  .filter(Boolean);

const mustHave = ['content-type', 'x-csrf-token', 'x-auth-bootstrap'];
const allowedHeaders = Array.from(new Set([...baseHeaders, ...mustHave])).join(', ');

const corsMw = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // Postman / same-origin
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin not allowed: ${origin}`));
  },
  credentials: process.env.CORS_ALLOW_CREDENTIALS === 'true',
  methods: process.env.CORS_ALLOW_METHODS || 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  allowedHeaders,
  maxAge: Number(process.env.CORS_MAX_AGE || '600'),
  optionsSuccessStatus: 204,
});

app.use(corsMw);
app.options('*', corsMw);

/* --------------------- Security, parsing, logging order --------------------- */
app.set('trust proxy', 1);
app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- CSRF: plant on GETs, require on mutations ---------------- */
// IMPORTANT: this comes BEFORE your routes so every GET plants/refreshes csrfToken
app.use(ensureCsrfCookie);
// If you prefer validating only on specific routers, put requireCsrfForMutations there.
// To validate globally on every mutation, uncomment this next line:
// app.use(requireCsrfForMutations);

app.use(hpp({ checkBody: true, checkQuery: true }));

/* --------------------------------- Routes --------------------------------- */
app.use('/api/auth', requireCsrfForMutations, authRoutes); // validate CSRF on auth mutations
app.use('/api/users', requireCsrfForMutations, userRoutes); // validate CSRF on user mutations
app.use('/api/contact', requireCsrfForMutations, contactRoutes);

/* ---------------------------- Global error JSON ---------------------------- */
app.use((err, req, res, _next) => {
  console.error('[error]', err.stack || err.message || err);
  const code = err.status || 500;
  res.status(code).json({ ok: false, error: err.message || 'Server error' });
});

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
