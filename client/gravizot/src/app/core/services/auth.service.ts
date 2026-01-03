import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, of, catchError, tap } from 'rxjs';
import { API } from '../constants/api.constants';

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  locale?: string | null;
  time_zone?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private _user = signal<User | null>(null);
  private _isLoggedIn = signal<boolean>(false);

  readonly user = computed(() => this._user());
  readonly isLoggedIn = computed(() => this._isLoggedIn());

  /** Used by the guard */
  isLoggedInValue(): boolean { return this._isLoggedIn(); }
  /** For templates with signals */
  isLoggedInSignal() { return this.isLoggedIn; }

  /** Run on startup via APP_INITIALIZER; safe to call anytime. */
  async bootstrapSession(): Promise<void> {
    try {
      const headers = new HttpHeaders({ 'X-Auth-Bootstrap': '1' });

      // 1) Plant CSRF (always 200)
      await firstValueFrom(
        this.http.get<{ ok: boolean }>(API.AUTH.CSRF, { withCredentials: true, headers })
          .pipe(catchError(() => of(null as any)))
      );

      // 2) Probe current user (may 401)
      const user = await firstValueFrom(
        this.http.get<User>(API.AUTH.ME, { withCredentials: true, headers })
          .pipe(catchError(() => of(null as any)))
      );

      if (user && user.email) {
        this._user.set(user); this._isLoggedIn.set(true);
      } else {
        this._user.set(null); this._isLoggedIn.set(false);
      }
    } catch {
      this._user.set(null); this._isLoggedIn.set(false);
    }
  }

  login(payload: { email: string; password: string; }) {
    return this.http.post<{ ok: true }>(API.AUTH.LOGIN, payload, { withCredentials: true }).pipe(
      tap(() => { void this.bootstrapSession(); })
    );
  }

  signup(payload: { email: string; password: string; }) {
    return this.http.post<{ ok: true }>(API.AUTH.SIGNUP, payload, { withCredentials: true }).pipe(
      tap(() => { void this.bootstrapSession(); })
    );
  }

  logout() {
    return this.http.post<{ ok: true }>(API.AUTH.LOGOUT, {}, { withCredentials: true }).pipe(
      tap(() => {
        this._user.set(null);
        this._isLoggedIn.set(false);
      })
    );
  }

  /** Called by refresh interceptor on unrecoverable auth */
  clear() {
    this._user.set(null);
    this._isLoggedIn.set(false);
  }
}
