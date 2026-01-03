import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { RefreshService } from '../services/refresh.service';
import { AuthService } from '../services/auth.service';

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const refreshService = inject(RefreshService);
  const auth = inject(AuthService);

  const isAuthEndpoint = /\/api\/auth\/(login|signup|refresh|me)\b/.test(req.url);
  const skipHeader = req.headers.has('X-Auth-Bootstrap'); // bootstrap probe should not trigger refresh

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isAuthEndpoint || skipHeader) {
        return throwError(() => err);
      }

      return refreshService.refresh().pipe(
        switchMap((ok) => {
          if (!ok) {
            auth.clear();
            return throwError(() => err);
          }
          const retried = req.clone({ withCredentials: true });
          return next(retried);
        }),
        catchError((e) => {
          auth.clear();
          return throwError(() => e);
        })
      );
    })
  );
};
