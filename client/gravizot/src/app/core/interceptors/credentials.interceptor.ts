import { HttpInterceptorFn } from '@angular/common/http';

/** Read a cookie value by name (simple parser). */
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(';').shift() || null;
  return null;
}

/**
 * Credentials & CSRF Interceptor
 * - Forces withCredentials to true
 * - Adds X-CSRF-Token header from the 'csrfToken' cookie on state-changing requests
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const withCreds = req.clone({ withCredentials: true });
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next(withCreds);
  }

  const csrf = getCookie('csrfToken');
  let headers = withCreds.headers;
  if (csrf) {
    headers = headers.set('X-CSRF-Token', csrf);
  }
  return next(withCreds.clone({ headers }));
};
