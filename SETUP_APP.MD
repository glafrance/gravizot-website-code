# SETUP_APP.MD
**Ubuntu 22.04 · Angular (static) + Node/Express (API) + PostgreSQL · Nginx + Let’s Encrypt (TLS)**

You already created a non‑root sudo user, enabled UFW, and set up Fail2Ban. This guide takes you from a fresh droplet to a production deployment with Nginx serving your Angular app and reverse‑proxying to your Node/Express API, with PostgreSQL on the same host and a Let’s Encrypt certificate.

> Tip: Everything in **ALL_CAPS_LIKE_THIS** is a placeholder you should change (domain, repo URLs, etc.).

---

## 0) One‑time variables (copy/paste these first)
```bash
# ---- CHANGE THESE ----
export APP_NAME="MYAPP"                           # e.g., bytezoggle
export DOMAIN="example.com"                       # apex domain
export ALT_DOMAIN="www.example.com"               # www domain (optional)
export BACKEND_PORT="3001"                        # internal Express port
export GIT_FRONTEND="git@github.com:YOU/FE.git"  # or https://...
export GIT_BACKEND="git@github.com:YOU/BE.git"   # or https://...
export LINUX_USER="$USER"                         # current non-root user
export EMAIL_FOR_LETSENCRYPT="you@example.com"    # for certbot
export DB_NAME="${APP_NAME}_db"
export DB_USER="${APP_NAME}_db_user"
export DB_PASS="$(openssl rand -base64 24)"
```

---

## 1) OS prep & base tools
```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install git curl build-essential unzip jq ca-certificates
```

**Time & swap (optional but recommended for builds):**
```bash
sudo timedatectl set-timezone America/New_York
# Create a 2G swap file if RAM is small (skip if you already have swap)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
```

---

## 2) DNS prerequisites
Point your domain to the droplet’s public IPv4 (and IPv6 if you have it). Create:
- **A** record: `@ -> DROPLET_IPV4`
- **A** record: `www -> DROPLET_IPV4` (if you’ll use www)
- (Optional) **AAAA** records for IPv6

You can verify later with `dig +short A $DOMAIN` (from your laptop or the server).

---

## 3) Install Node.js LTS and PM2
Use NodeSource for a current LTS (22.x at time of writing).

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs
node -v && npm -v
sudo npm i -g pm2
# PM2 startup so your apps restart on reboot
pm2 startup systemd -u "$LINUX_USER" --hp "/home/$LINUX_USER"
```

> If you prefer nvm, you can install nvm and `nvm install --lts` instead. Keep PM2 global in whichever Node you use for production.

---

## 4) Install PostgreSQL and create DB
```bash
sudo apt -y install postgresql postgresql-contrib
sudo systemctl enable --now postgresql
# Create DB, user, password
sudo -u postgres psql <<SQL
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

echo "DB created: ${DB_NAME}, user: ${DB_USER}, pass: ${DB_PASS}"
```

**Lock Postgres to localhost & keep port closed to the Internet:**
- Ensure Postgres listens only on localhost (this is the default on Ubuntu):
  - `/etc/postgresql/*/main/postgresql.conf`: `listen_addresses = 'localhost'`
- UFW should **not** open port 5432. Keep it blocked.

```bash
sudo ufw status
# Later we’ll allow Nginx Full; SSH should already be allowed.
```

---

## 5) Prepare folder structure
```bash
sudo mkdir -p /var/www/${APP_NAME}/{frontend,backend}
sudo chown -R ${LINUX_USER}:${LINUX_USER} /var/www/${APP_NAME}
```

---

## 6) Clone & configure the backend (Express)
```bash
cd /var/www/${APP_NAME}/backend
git clone "$GIT_BACKEND" .

# Install dependencies
npm ci || npm i

# If you use Prisma/TypeORM/Sequelize, run build/migrate steps later after .env is set.
```

### 6.1) Backend environment file
Create `/var/www/${APP_NAME}/backend/.env` (do not commit to git):
```bash
cat > /var/www/${APP_NAME}/backend/.env <<'ENV'
NODE_ENV=production
PORT=${BACKEND_PORT}

# Example for Prisma / standard Postgres URLs:
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public

# CORS: ideally not needed if you serve API under same domain via Nginx
# If you still validate origins in code, set it to your HTTPS origin(s)
ALLOWED_ORIGINS=https://${DOMAIN},https://${ALT_DOMAIN}

# Session / JWT / CSRF secrets (examples; generate strong values)
JWT_SECRET=$(openssl rand -hex 32)
CSRF_SECRET=$(openssl rand -hex 32)

# Cookie security
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

# If your app needs other secrets, add them here.
ENV

# Render variables in-place (optional convenience)
sed -i "s/\${BACKEND_PORT}/${BACKEND_PORT}/g" /var/www/${APP_NAME}/backend/.env
sed -i "s/\${DB_USER}/${DB_USER}/g" /var/www/${APP_NAME}/backend/.env
sed -i "s/\${DB_PASS}/${DB_PASS}/g" /var/www/${APP_NAME}/backend/.env
sed -i "s/\${DB_NAME}/${DB_NAME}/g" /var/www/${APP_NAME}/backend/.env
sed -i "s/\${DOMAIN}/${DOMAIN}/g" /var/www/${APP_NAME}/backend/.env
sed -i "s/\${ALT_DOMAIN}/${ALT_DOMAIN}/g" /var/www/${APP_NAME}/backend/.env
```

### 6.2) Express behind Nginx (proxy) essentials
In your Express entry (e.g., `server.ts/js`):
```js
app.set("trust proxy", 1); // so req.secure reflects HTTPS via Nginx
// If you set secure cookies:
const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" };
// If you enforce CSRF via header (e.g., x-csrf-token), ensure your Nginx forwards headers (it does by default).
```

If you have a global CORS middleware and you will serve the SPA and API on the **same domain**, disable CORS or restrict it to `https://YOUR_DOMAIN`. Serving under the same domain & path prefix (`/api`) avoids most CORS issues entirely.

### 6.3) Build (if TypeScript) & run DB migrations
```bash
# If TypeScript:
npm run build

# Example with Prisma (if your backend uses it):
# npx prisma migrate deploy    # apply existing migrations
# npx prisma generate          # generate client
```

### 6.4) PM2 process
Create `/var/www/${APP_NAME}/backend/ecosystem.config.cjs`:
```js
module.exports = {
  apps: [{
    name: `${process.env.APP_NAME || "backend"}`,
    script: "./dist/server.js",          // or your entry file
    cwd: "/var/www/MYAPP/backend",       // CHANGE: set to your app folder
    env: {
      NODE_ENV: "production",
      PORT: process.env.PORT || "3001"
    },
    instances: "max",
    exec_mode: "cluster",
    max_memory_restart: "500M",
    error_file: "/var/www/MYAPP/backend/logs/err.log",
    out_file: "/var/www/MYAPP/backend/logs/out.log",
    merge_logs: true
  }]
};
```

> If your entry file is not `dist/server.js`, adjust accordingly. Create the logs dir:
```bash
mkdir -p /var/www/${APP_NAME}/backend/logs
```

Start & persist:
```bash
cd /var/www/${APP_NAME}/backend
# Optional: export APP_NAME for the ecosystem config
export APP_NAME="${APP_NAME}"
pm2 start ecosystem.config.cjs
pm2 save
```

> Alternative to PM2: a **systemd** unit is provided in the appendix.

---

## 7) Build & stage the Angular frontend
```bash
cd /var/www/${APP_NAME}/frontend
git clone "$GIT_FRONTEND" .
npm ci || npm i

# Ensure your Angular app calls the API at a relative path like `/api` in production.
# For example, set API base URL in environment.prod.ts to '/api'.

# Build for production (adjust if you have custom configs)
npm run build -- --configuration production
```

Find the build output directory (depends on Angular version/project setup):
- Commonly: `dist/PROJECT_NAME/` (Angular 15/16)
- Or: `dist/PROJECT_NAME/browser/` (Angular 17+ with SSR configs even if SSR disabled)

For simplicity, copy the contents that include `index.html` to a fixed publish folder:
```bash
# Detect first folder under dist that contains index.html
BUILD_DIR=$(dirname "$(find dist -type f -name index.html | head -n1)")
echo "Detected build dir: $BUILD_DIR"

sudo mkdir -p /var/www/${APP_NAME}/public
sudo rsync -a --delete "${BUILD_DIR}/" /var/www/${APP_NAME}/public/
sudo chown -R ${LINUX_USER}:${LINUX_USER} /var/www/${APP_NAME}/public
```

---

## 8) Install & configure Nginx
```bash
sudo apt -y install nginx
sudo systemctl enable --now nginx
```

### 8.1) UFW: allow Nginx
```bash
sudo ufw allow 'Nginx Full'
# If you previously allowed Nginx HTTP only, it's fine for now. After TLS we can remove 'Nginx HTTP'.
sudo ufw status
```

### 8.2) Nginx server block
Create `/etc/nginx/sites-available/${DOMAIN}`:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${ALT_DOMAIN};

    # Serve Angular build (static files)
    root /var/www/${APP_NAME}/public;
    index index.html;

    # Increase upload size if your app uploads files
    client_max_body_size 20M;

    # Compression (basic)
    gzip on;
    gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;
    gzip_min_length 1024;

    # Static asset caching
    location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files $uri =404;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API reverse proxy
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Basic security headers (TLS version will add HSTS)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
}
```

Enable the site and test:
```bash
sudo ln -s /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
# Disable the default site if still enabled
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

> At this point, navigating to `http://YOUR_DOMAIN` should show your Angular app (without TLS).

---

## 9) Let’s Encrypt TLS (Certbot)
```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d ${DOMAIN} -d ${ALT_DOMAIN} --redirect -m ${EMAIL_FOR_LETSENCRYPT} --agree-tos --no-eff-email
```

- **--redirect** adds HTTP→HTTPS redirects automatically.
- Renewal is handled by a systemd timer. Test it:
```bash
sudo certbot renew --dry-run
```

**UFW cleanup (optional):** once HTTPS is working, you can remove plain HTTP if desired, but typically you keep it open for the redirect.
```bash
sudo ufw status numbered
# (optional) sudo ufw delete <rule_number_for_Nginx HTTP>
```

**HSTS (optional but recommended after confirming TLS works):** add to your HTTPS server block:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```
> Only add HSTS when you are sure HTTPS will remain enabled; it instructs browsers to use HTTPS exclusively.

---

## 10) Final checks
- Confirm Nginx is serving the SPA:
  - `curl -I https://${DOMAIN}` → expect `200` or `304`
- Confirm API works through Nginx:
  - `curl -I https://${DOMAIN}/api/health` (create a simple health route in Express)
- Confirm cookies (if any) are `Secure` and `SameSite` as intended (check browser devtools).
- Confirm Express sees `req.secure === true` (because of `app.set('trust proxy', 1)`).

---

## 11) Deploying updates

### 11.1) Backend (API)
```bash
cd /var/www/${APP_NAME}/backend
git pull
npm ci || npm i
npm run build
# Run DB migrations if applicable (Prisma example):
# npx prisma migrate deploy && npx prisma generate
pm2 reload all    # or pm2 reload <app-name>
pm2 save
```

### 11.2) Frontend (Angular)
```bash
cd /var/www/${APP_NAME}/frontend
git pull
npm ci || npm i
npm run build -- --configuration production
BUILD_DIR=$(dirname "$(find dist -type f -name index.html | head -n1)")
sudo rsync -a --delete "${BUILD_DIR}/" /var/www/${APP_NAME}/public/
sudo nginx -t && sudo systemctl reload nginx
```

> Zero‑downtime tip: for the SPA, `rsync --delete` is effectively atomic for users caching assets; for the API, PM2’s `reload` spins new workers before killing old ones.

---

## 12) Logs & troubleshooting
- Nginx: `sudo journalctl -u nginx -f` and `/var/log/nginx/{access,error}.log`
- PM2 (backend): `pm2 logs` and the files you configured in `ecosystem.config.cjs`
- TLS issues: `sudo certbot renew --dry-run` and check `/etc/letsencrypt/renewal`

**Common gotchas**
- CORS failures: serve the API under `/api` **on the same domain** to avoid CORS; else, explicitly allow your HTTPS origin(s) server‑side.
- Cookies not set: ensure `app.set('trust proxy', 1)` and use `secure: true` cookies only over HTTPS.
- SPA 404s on refresh: make sure `try_files $uri $uri/ /index.html;` is in the Nginx `location /` block.
- Large uploads failing: increase `client_max_body_size` in Nginx and any proxy/body‑parser limits in Express.
- Postgres connectivity: keep Postgres bound to localhost, ensure `DATABASE_URL` uses `localhost`, not `127.0.0.1` if your client library needs sockets (Prisma works fine with either).

---

## 13) Backups (quick start)
**PostgreSQL (daily cron as root or postgres):**
```bash
sudo mkdir -p /var/backups/postgres && sudo chown postgres:postgres /var/backups/postgres
sudo -u postgres bash -lc 'cat > /etc/cron.daily/pg_dump_${APP_NAME} <<CRON
#!/usr/bin/env bash
set -euo pipefail
STAMP=\$(date +%F)
pg_dump ${DB_NAME} | gzip > /var/backups/postgres/${DB_NAME}-\${STAMP}.sql.gz
find /var/backups/postgres -type f -name "${DB_NAME}-*.sql.gz" -mtime +7 -delete
CRON
chmod +x /etc/cron.daily/pg_dump_${APP_NAME}'
```

**Frontend:** Your Git repo is the source of truth. (Optionally snapshot `/var/www/${APP_NAME}/public` on each deploy.)

**Backend:** Code is in Git; back up `.env` and any persistent upload directories.

---

## 14) Optional hardening & niceties
- **Fail2Ban**: add Nginx jails for common abuse patterns (bot scans, 404 bursts).
- **Nginx rate limiting** (e.g., on `/api/`):
  ```nginx
  # in http{}:
  limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
  # in server{} location /api/:
  limit_req zone=api_limit burst=20 nodelay;
  ```
- **pm2-logrotate**:
  ```bash
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 10M
  pm2 set pm2-logrotate:retain 14
  pm2 save
  ```

---

## 15) Appendix A — systemd (alternative to PM2)
Create `/etc/systemd/system/${APP_NAME}-backend.service`:
```ini
[Unit]
Description=${APP_NAME} Node API
After=network.target postgresql.service

[Service]
Type=simple
User=${LINUX_USER}
WorkingDirectory=/var/www/${APP_NAME}/backend
Environment=NODE_ENV=production
EnvironmentFile=/var/www/${APP_NAME}/backend/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
# Provide some resource limits if desired
# LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Enable & start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ${APP_NAME}-backend
sudo systemctl status ${APP_NAME}-backend --no-pager
```

---

## 16) Appendix B — sample health checks
**Express route:**
```js
app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
});
```

**Nginx local test:**
```bash
curl -sSf http://127.0.0.1:${BACKEND_PORT}/api/health | jq
curl -I https://${DOMAIN}/api/health
```

---

## 17) Quick rollback
- **Backend**: `pm2 list && pm2 logs` → `git checkout <last_good_tag>` → `npm ci && npm run build` → `pm2 reload all`
- **Frontend**: restore last good build you rsynced (keep a dated backup: `/var/www/${APP_NAME}/public_prev`) then swap:
  ```bash
  sudo mv /var/www/${APP_NAME}/public /var/www/${APP_NAME}/public_bad_$(date +%s)
  sudo cp -a /var/www/${APP_NAME}/public_prev /var/www/${APP_NAME}/public
  sudo nginx -t && sudo systemctl reload nginx
  ```

---

## 18) What you’ll change (summary)
- **Placeholders**: `APP_NAME`, `DOMAIN`, `ALT_DOMAIN`, `GIT_FRONTEND`, `GIT_BACKEND`, `EMAIL_FOR_LETSENCRYPT`.
- **Backend entry file**: If it’s not `dist/server.js`, update PM2/systemd configs.
- **Angular dist path**: Confirm the correct folder containing `index.html` under `dist/`.
- **DB URL & migrations**: Match your ORM (Prisma/TypeORM/etc.).
- **API base URL in Angular**: Use `/api` to avoid CORS.
- **Nginx client_max_body_size**: Adjust for your upload needs.
- **Security headers/HSTS**: Tweak CSP/Permissions‑Policy if you use things like iframes, geolocation, etc.

---

### Done! 
You now have: Angular served by Nginx, Express behind Nginx on `:3001`, PostgreSQL local‑only, TLS via Let’s Encrypt, and a repeatable deploy flow.
