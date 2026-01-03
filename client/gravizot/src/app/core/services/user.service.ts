import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { API } from '../constants/api.constants';

export interface UpdateProfileDto {
  full_name?: string | null;
  locale?: string | null;
  time_zone?: string | null;
}

export interface ContactMessage {
  email: string | null;
  topic: string | null;
  details: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  getMe() {
    return this.http.get(API.USER.ME, { withCredentials: true });
  }

  updateMyProfile(body: UpdateProfileDto) {
    return this.http.put(API.USER.ME, body, { withCredentials: true });
  }
}
