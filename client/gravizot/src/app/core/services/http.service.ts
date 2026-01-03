import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable } from 'rxjs';

type Dict = Record<string, string | number | boolean | null | undefined>;

function buildParams(params?: Dict): HttpParams {
  let p = new HttpParams();
  if (!params) return p;
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class HttpService {
  private http = inject(HttpClient);

  get<T>(base: string, path: string, params?: Dict): Observable<T> {
    return this.http.get<T>(`${base}${path}`, { params: buildParams(params), withCredentials: true });
  }

  delete<T>(base: string, path: string, params?: Dict): Observable<T> {
    return this.http.delete<T>(`${base}${path}`, { params: buildParams(params), withCredentials: true });
  }

  postJson<T>(base: string, path: string, body?: any, headers?: Dict): Observable<T> {
    const h = new HttpHeaders({ 'Content-Type': 'application/json', ...(headers || {}) });
    return this.http.post<T>(`${base}${path}`, body ?? {}, { headers: h, withCredentials: true });
  }

  postForm<T>(base: string, path: string, form: FormData, headers?: Dict): Observable<T> {
    const normalized: Record<string, string> = {};
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        normalized[key] = String(value);
      }
    }

    const h = new HttpHeaders(normalized);
    return this.http.post<T>(`${base}${path}`, form, { headers: h, withCredentials: true });
  }

  putJson<T>(base: string, path: string, body?: any, headers?: Dict): Observable<T> {
    const h = new HttpHeaders({ 'Content-Type': 'application/json', ...(headers || {}) });
    return this.http.put<T>(`${base}${path}`, body ?? {}, { headers: h, withCredentials: true });
  }

  stream<T = any>(base: string, path: string, params?: Dict): Observable<T> {
    const url = `${base}${path}`;
    return new Observable<T>((sub) => {
      const token = Math.random().toString(36).slice(2);
      const es = new EventSource(`${url}${url.includes('?') ? '&' : '?'}sse_token=${token}`, { withCredentials: true } as any);
      es.onmessage = (evt) => {
        try {
          sub.next(JSON.parse(evt.data));
        } catch {
          sub.next((evt.data as unknown) as T);
        }
      };
      es.onerror = (err) => {
        sub.error(err);
        es.close();
      };
      return () => es.close();
    });
  }
}
