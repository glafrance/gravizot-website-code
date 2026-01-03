import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API } from '../constants/api.constants';

export interface ContactMessage {
  email: string | null;
  topic: string | null;
  message: string | null;
}

@Injectable({ providedIn: 'root' })
export class ContactService {
  private http = inject(HttpClient);

  async submitContactMessage(body: ContactMessage) {
    await firstValueFrom(this.http.get(API.MISC.GET_CSRF, { withCredentials: true }));

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    return firstValueFrom(
      this.http.post(API.MISC.CONTACT, body, {
        headers,
        withCredentials: true, // ensures cookies flow
      })
    );
  }
}
