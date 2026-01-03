import { ApplicationConfig, APP_INITIALIZER, inject } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { refreshInterceptor } from './core/interceptors/refresh.interceptor';
import { AuthService } from './core/services/auth.service';

/**
 * Registers:
 * - credentialsInterceptor: adds withCredentials and X-CSRF-Token header
 * - refreshInterceptor: on 401, attempts /api/auth/refresh and retries the request
 * - APP_INITIALIZER: boots session at app startup (GET /api/auth/me) to seed user and CSRF
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([
      // Order matters: refresh should see responses first (outermost wrapper).
      refreshInterceptor,
      credentialsInterceptor,
    ])),
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const auth = inject(AuthService);
        return () => { auth.bootstrapSession(); return Promise.resolve(); }; // fire-and-forget
      },
      multi: true
    }
  ]
};
