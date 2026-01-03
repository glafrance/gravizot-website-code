# Frontend Auth (Angular 20) — Cookies + CSRF

This frontend is wired for **cookie** auth (no `localStorage`). We:

- Send **credentials** on every request (cookies) via a global **HTTP interceptor**
- Attach `X‑CSRF‑Token` on **mutating** requests by reading the `csrfToken` cookie
- Expose a small `AuthService` that holds `isLoggedIn` and `user` **signals**
- Add a `UserService` for profile **GET/PUT**

## Changes made

- `core/interceptors/auth.interceptor.ts` → now `credentialsInterceptor` (sets `withCredentials: true` and CSRF header)
- `app.config.ts` → registers the interceptor with `provideHttpClient(withInterceptors([credentialsInterceptor]))`
- `core/services/http.service.ts` → always calls with `{ withCredentials: true }`
- `core/services/auth.service.ts` → **no localStorage**, calls `/api/auth/*` and tracks `user`
- `core/services/user.service.ts` → **NEW**, `getMyProfile()` / `updateMyProfile()`
- `core/constants/api.constants.ts` → `API_BASE_URL` set to `http://localhost:3001` and added endpoint constants

## Typical usage

In your root component (or an app init effect), hydrate session on boot:

```ts
constructor(auth: AuthService) {
  auth.bootstrapSession();
}
```

Login:

```ts
this.auth.login({ email, password });
// on success: auth.isLoggedIn() === true; auth.user() contains server user
```

Update profile:

```ts
this.userService.updateMyProfile({ full_name: 'Greg Lafrance' }).subscribe();
```

## CORS / CSRF

Because we use cookies, your HttpClient requests **must** send credentials.
We do this globally via the interceptor. The backend requires `X‑CSRF‑Token`
on POST/PUT/PATCH/DELETE. The interceptor reads the `csrfToken` cookie and
adds that header automatically.

Ensure the backend sends `csrfToken` cookie (the provided middleware does this for all GETs).

# Client Auth Enhancements (Angular 20)

This update adds:

- **APP_INITIALIZER** to bootstrap session (`GET /api/auth/me`) on startup (also seeds the `csrfToken` cookie).
- **Credentials & CSRF Interceptor**: always `withCredentials`, adds `X-CSRF-Token` on POST/PUT/PATCH/DELETE.
- **Refresh Interceptor**: on `401`, calls `/api/auth/refresh` and retries the original request once.
- **Auth Guard** using **signals**.
- **UserService** for `GET/PUT /api/users/me` profile ops.

## Setup

1. Ensure your server's CORS allows your Angular origin (`ALLOWED_ORIGINS`) and cookies are enabled.
2. In your route config, protect routes:

```ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'dashboard', canActivate: [authGuard], loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard) },
];
```

3. The app already registers interceptors and the initializer in `app.config.ts`:
   - `refreshInterceptor` first, then `credentialsInterceptor`.
   - `APP_INITIALIZER` → `AuthService.bootstrapSession()`.

## Using AuthService

```ts
constructor(private auth: AuthService) {}

onLogin(email: string, password: string) {
  this.auth.login({ email, password }).subscribe();
}

onLogout() {
  this.auth.logout().subscribe();
}
```

## CSRF

- A readable `csrfToken` cookie is set by any GET to your API (e.g., the bootstrap `/api/auth/me` call).
- The credentials interceptor adds `X-CSRF-Token` for mutation requests automatically.

## Refresh & Retry

- If an API call returns `401`, the **refresh interceptor** hits `/api/auth/refresh`.
- On success, it retries the original request once.
- On failure, it clears auth state (signals: `isLoggedIn = false; user = null`).

## Notes

- No tokens in `localStorage`. Cookies carry auth.
- Keep UI and API on the **same site + HTTPS** in production so cookies get `Secure` and better `SameSite` behavior.
