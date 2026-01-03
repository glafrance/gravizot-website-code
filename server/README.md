# Postgres JS Auth Starter (Express + PostgreSQL, JavaScript)

A minimal Express API (JavaScript only, no TypeScript) with **signup / login / logout** using PostgreSQL.
Auth uses **httpOnly JWT cookies** (secure in production) and simple email+password auth.

## 1) Requirements
- Node 18+
- PostgreSQL 14+ (17 recommended)
- macOS/Linux/Windows supported

## 2) Configure environment
Copy the example env and edit values:
```bash
cp .env.sample .env
# then edit .env (DATABASE_URL, JWT_SECRET, ALLOWED_ORIGINS, etc.)
```

## 3) Install deps
```bash
npm i
# or: pnpm i  (if you prefer pnpm)
```

## 4) Create database objects (tables etc.)
Run the migration script (uses `DATABASE_URL` from .env):
```bash
npm run db:migrate
```

## 5) Start the API
```bash
npm run dev   # auto-reload with nodemon
# or
npm start     # plain node
```

The server defaults to http://localhost:3001.

### API endpoints
- `POST /api/auth/signup` `{ email, password }`
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/logout` (clears cookie)
- `GET /api/auth/me` (requires cookie; returns current user)

### Example with curl
```bash
# Signup (stores cookie to cookie.txt)
curl -i -c cookie.txt -H "Content-Type: application/json"   -d '{"email":"user@example.com","password":"StrongPass123"}'   http://localhost:3001/api/auth/signup

# Login
curl -i -c cookie.txt -b cookie.txt -H "Content-Type: application/json"   -d '{"email":"user@example.com","password":"StrongPass123"}'   http://localhost:3001/api/auth/login

# Who am I?
curl -i -b cookie.txt http://localhost:3001/api/auth/me

# Logout
curl -i -b cookie.txt -X POST http://localhost:3001/api/auth/logout
```

## Database Schema
See `db/schema.sql` (creates `users` table + extension).

---

**Security defaults**: httpOnly cookie; SameSite=Lax; `secure` cookies when `NODE_ENV=production`. Update `JWT_SECRET` to a long random string.
