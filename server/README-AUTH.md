# Backend Auth (Node.js + Postgres) — Cookie‑based JWT, Refresh Rotation, CSRF

This backend upgrades your existing auth to **HttpOnly cookie** sessions with:

- **Short‑lived access JWT** (`at` cookie, 15 minutes, HttpOnly)
- **Opaque refresh token** (`rt` cookie, 7 days, HttpOnly) stored **hashed** in Postgres with **rotation**
- **CSRF protection** via **double‑submit** cookie (`csrfToken` cookie + `X‑CSRF‑Token` header)
- CORS configured for **credentials**

## Endpoints

- `POST /api/auth/signup` — create account, sets cookies, returns `{ ok, user }`
- `POST /api/auth/login` — verify credentials, sets cookies, returns `{ ok, user }`
- `POST /api/auth/logout` — revokes current refresh token and clears cookies
- `POST /api/auth/refresh` — rotates refresh token and issues a new access token
- `GET  /api/auth/me` — returns `{ ok, user }` when authenticated
- `GET  /api/users/me` — same as above (user route)
- `PUT  /api/users/me` — update `full_name`, `locale`, `time_zone`

## Cookies

- `at` — **HttpOnly**, `SameSite=Lax`, TTL = `ACCESS_TTL_SEC` (default 15m)
- `rt` — **HttpOnly**, `SameSite=Lax`, TTL = `REFRESH_TTL_SEC` (default 7d)
- `csrfToken` — **readable by JS** (not HttpOnly), `SameSite=Lax`

> In production set `COOKIE_DOMAIN` (e.g. `.yourdomain.com`) and run behind HTTPS so `Secure` flag is active.

## Setup

1. **Environment**

Create a `.env` next to your project root (or set `DOTENV_PATH`):

```
DATABASE_URL=postgres://USER:PASS@localhost:5432/aidb
JWT_SECRET=change-me-access
REFRESH_TTL_SEC=604800
ACCESS_TTL_SEC=900
ALLOWED_ORIGINS=http://localhost:4200
COOKIE_DOMAIN=localhost
COOKIE_SAMESITE=lax
NODE_ENV=development
PORT=3001
```

2. **Install & migrate**

```
cd server
pnpm i   # or npm i / yarn
pnpm run db:migrate
pnpm run dev
```

The migrate script runs `db/schema.sql` which now includes the `refresh_tokens` table and extra profile columns on `users`.

## How it works (flow)

1. **Login/Signup** → server sets `at` + `rt` cookies. Client never stores tokens.
2. **Authenticated requests** → browser **sends cookies automatically** (`withCredentials: true`).
3. **Access token expiry** → client calls `POST /api/auth/refresh` (you can do this proactively or on 401).
4. **Refresh rotation** → server revokes old `rt`, issues a new one, and signs a fresh access JWT.
5. **Logout** → refresh token is revoked and both cookies are cleared.

## Security Notes

- Access JWT is only **15 minutes**; no long‑term risk if intercepted.
- Refresh tokens are **random opaque** values stored **hashed**; if stolen, rotation revokes the old token on first use.
- CSRF protection requires `X‑CSRF‑Token` header to match `csrfToken` cookie on **mutating** requests.
- CORS allows only origins in `ALLOWED_ORIGINS` and enables `credentials: true`.

## Files you care about

- `server/server.js` — CORS, Helmet, cookies, CSRF middleware + route wiring
- `server/src/middleware/csrf.js` — sets/validates CSRF cookie/header
- `server/src/middleware/auth.js` — reads `at` cookie, loads `req.user`
- `server/src/utils/jwt.js` — access JWT sign/verify
- `server/src/utils/tokens.js` — refresh token storage, rotation, cookie helpers
- `server/src/controllers/auth.controller.js` — signup/login/logout/refresh
- `server/src/controllers/user.controller.js` — GET/PUT profile
- `server/src/routes/*.routes.js` — routes
- `server/db/schema.sql` — users + refresh_tokens
- `server/db/migrate.js` — run schema

