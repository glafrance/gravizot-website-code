import { HttpInterceptorFn } from '@angular/common/http';

function readCookie(name: string): string | null {
  const part = document.cookie.split('; ').find(p => p.startsWith(name + '='));
  return part ? decodeURIComponent(part.split('=')[1]) : null;
}

/** 
 * Ensures cookies are sent on every request and attaches X-CSRF-Token
 * on mutating methods to satisfy the backend's double-submit CSRF check.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  let clone = req.clone({ withCredentials: true });
  if (['POST','PUT','PATCH','DELETE'].includes(req.method)) {
    const csrf = readCookie('csrfToken');
    if (csrf) {
      clone = clone.clone({ setHeaders: { 'X-CSRF-Token': csrf } });
  }
  }
  return next(clone);
};
