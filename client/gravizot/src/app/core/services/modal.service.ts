import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ModalService {
  private _showSignupLogin = new BehaviorSubject(false);
  showSignupLogin = toSignal(this._showSignupLogin.asObservable(), { initialValue: false });

  openSignupLogin() { this._showSignupLogin.next(true); }
  closeSignupLogin() { this._showSignupLogin.next(false); }
}
