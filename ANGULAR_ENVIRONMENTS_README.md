# Angular Environments: Dev & Prod — Setup Guide

This README explains **what the `environments` folder is for**, which files to create, and **how to configure Angular** so your app uses the right settings in **development** and **production** builds. It includes practical examples for setting API base URLs (e.g., `/api` behind Nginx in prod vs `http://localhost:3001/api` in dev).

---

## Why an `environments` folder?

Angular applications often need **different settings per environment** (development, staging, production). Examples include:
- API base URLs (localhost vs your domain)
- Feature flags (enable debug tools in dev, disable in prod)
- Analytics toggles, logging levels, etc.

The `environments` folder holds **TypeScript files that export a simple config object**. During build, Angular can **swap** one file for another via **file replacements** configured in `angular.json`.

---

## Recommended structure

Create the folder and two files:

```
src/
  environments/
    environment.ts           # development defaults
    environment.prod.ts      # production settings
```

> This pattern is widely used: `environment.ts` is the default (dev), and **Angular replaces it with** `environment.prod.ts` when you build with `--configuration production`.

---

## File contents

### `src/environments/environment.ts` (development)
Use explicit localhost URLs and looser flags for debugging.

```ts
// src/environments/environment.ts
export const environment = {
  production: false,
  API_BASE: 'http://localhost:3001/api',  // dev server → Node API on your laptop/droplet port
  ENABLE_DEBUG_TOOLS: true,
  LOG_LEVEL: 'debug',                     // example: 'debug' | 'info' | 'warn' | 'error'
};
```

### `src/environments/environment.prod.ts` (production)
Use **same-origin** `/api` so requests go through Nginx on your domain (no CORS headaches).

```ts
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  API_BASE: '/api',              // same-origin, proxied by Nginx to your Node API
  ENABLE_DEBUG_TOOLS: false,
  LOG_LEVEL: 'info',
};
```

> If you expose your API on a **different** domain, set `API_BASE` to the full HTTPS URL, e.g. `https://api.example.com` — then configure CORS in your backend accordingly.

---

## Using the environment in code

Import once and use everywhere you make HTTP calls or reference feature flags:

```ts
import { environment } from '../environments/environment';  // adjust the path if needed

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = environment.API_BASE;

  constructor(private http: HttpClient) {}

  signup(data: unknown) {
    return this.http.post(`${this.base}/auth/signup`, data);
  }

  me() {
    return this.http.get(`${this.base}/auth/me`);
  }
}
```

> Tip: Centralize your base URL in one service and reuse it (`environment.API_BASE`).

---

## Hooking environments into the build (`angular.json`)

Open `angular.json` and ensure your **build** and **serve** configurations include the **file replacement** for production builds.

A typical snippet looks like this (only the relevant parts shown):

```jsonc
{
  "projects": {
    "your-app-name": {
      "architect": {
        "build": {
          "configurations": {
            "production": {
              "fileReplacements": [
                {
                  "replace": "src/environments/environment.ts",
                  "with": "src/environments/environment.prod.ts"
                }
              ],
              "optimization": true,
              "outputHashing": "all",
              "sourceMap": false,
              "extractLicenses": true
            },
            "development": {
              "buildOptimizer": false,
              "optimization": false,
              "sourceMap": true
            }
          }
        },
        "serve": {
          "configurations": {
            "production": {
              "browserTarget": "your-app-name:build:production"
            },
            "development": {
              "browserTarget": "your-app-name:build:development"
            }
          },
          "defaultConfiguration": "development"
        }
      }
    }
  }
}
```

> Replace `"your-app-name"` with your actual Angular project name (the name that appears under `projects` in `angular.json`).

---

## Build & run commands

**Development (serve locally with live reload):**
```bash
ng serve
# or explicitly
ng serve --configuration development
```
This uses `src/environments/environment.ts` (your dev config).

**Production build (optimized, for deployment):**
```bash
ng build --configuration production
```
This uses `src/environments/environment.prod.ts` via file replacement, and outputs to `dist/<app-name>/browser/` (Angular 17+) or `dist/<app-name>/` (earlier versions). Upload those files to your Nginx web root.

---

## Nginx note for production

If `API_BASE` is `/api`, your Nginx server should **proxy `/api` to your Node app**:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:3001/;  # if your Express routes are mounted at root
  # OR, if your Express uses '/api' in code:
  # proxy_pass http://127.0.0.1:3001;  # (no trailing slash)
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## Optional: add more environments

You can add more files, e.g. `environment.staging.ts`, and a matching configuration in `angular.json`:
- Add a **file replacement** for staging builds.
- Build with `ng build --configuration staging`.

Example staging file:
```ts
export const environment = {
  production: false,
  API_BASE: 'https://staging.gravizot.com/api',
  ENABLE_DEBUG_TOOLS: false,
  LOG_LEVEL: 'info',
};
```

---

## Common pitfalls & tips

- **Wrong import path**: Always import from `../environments/environment` (without `.prod`); Angular handles the swap at build time.
- **Forgetting file replacements**: If prod still calls `http://localhost:3001`, your `angular.json` replacement isn’t set up correctly.
- **Hardcoded URLs**: Avoid scattering full URLs; use `environment.API_BASE` everywhere.
- **SSR** (Angular Universal): You can still use environment files, but prefer **same-origin** URLs so the server and browser agree.
- **Runtime configuration**: If you need to change settings **without rebuilding**, consider a runtime JSON (e.g., `/assets/runtime-config.json`) fetched at startup. Use an `APP_INITIALIZER` to load it and merge with `environment` values.

---

## Quick checklist

- [ ] Create `src/environments/environment.ts` (dev) and `src/environments/environment.prod.ts` (prod)
- [ ] Configure `angular.json` fileReplacements for `production`
- [ ] Use `environment.API_BASE` in your services
- [ ] Build with `ng build --configuration production`
- [ ] Upload `dist/<app>/browser/*` to your Nginx web root
- [ ] Ensure Nginx proxies `/api` to your Node app

---

**That’s it!** You now have a clean, conventional `environments` setup for Angular with sensible dev vs prod defaults.
