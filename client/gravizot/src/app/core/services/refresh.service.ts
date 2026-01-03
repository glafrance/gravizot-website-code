import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, map, catchError, of, shareReplay, Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../constants/api.constants';
import { AuthService } from './auth.service';

/**
 * Ensures only one refresh HTTP request is in flight at a time.
 * Consumers subscribe to the same shared Observable.
 */
@Injectable({ providedIn: 'root' })
export class RefreshService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private ongoing$: Observable<boolean> | null = null;

  refresh(): Observable<boolean> {
    if (!this.ongoing$) {
      const url = `${API_BASE_URL}/auth/refresh`;
      this.ongoing$ = this.http.post<{ ok: boolean }>(url, {}, { withCredentials: true }).pipe(
        tap(() => {
          // Optionally refresh "me" in background to update signals quickly.
          void this.auth.bootstrapSession();
        }),
        map(() => true),
        catchError(() => of(false)),
        finalize(() => { this.ongoing$ = null; }),
        shareReplay(1)
      );
    }
    return this.ongoing$;
  }
}
