import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { ButtonComponent } from '../../shared/components/app-button/app-button';
import { Gravizot } from '../../shared/components/gravizot/gravizot';
import { ModalService } from '../../core/services/modal.service';
import { UI_STRINGS as UI } from '../../core/constants/ui-string.constants';

type AuthMode = 'signup' | 'login';

const EMAIL_REGEX =
  /^(?=.{1,254}$)(?=.{1,64}@)[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_\+={}[\]:;"'<>,.?/])[A-Za-z\d!@#$%^&*()\-_\+={}[\]:;"'<>,.?/]{8,15}$/

function passwordsMatchWhen(getIsSignup: () => boolean) {
  return (group: AbstractControl): ValidationErrors | null => {
    if (!getIsSignup()) return null;
    const g = group as FormGroup;
    const p = g.get('password');
    const c = g.get('confirmPassword');

    if (p && c && p.value !== c.value) {
      c?.setErrors({ passwordMismatch: true });
    } else {
      if (c?.hasError('passwordMismatch')) {
        c.setErrors(null);
      }
    }
    return null; // keep error at control level, not group
  };
}

@Component({
  selector: 'signup-login',
  imports: [
    ButtonComponent,
    CommonModule,
    Gravizot,
    ReactiveFormsModule
  ],
  templateUrl: './signup-login.html',
  styleUrls: ['./signup-login.scss']
})
export class SignupLogin {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private modalService = inject(ModalService)
  readonly mode = signal<AuthMode>('signup');
  readonly isSignup = computed(() => this.mode() === 'signup');
  allowedCharacters = UI.ALLOWED_CHARACTERS;

  loading = signal(false);
  errorMsg = signal<string | null>(null);

  readonly authForm = this.fb.group(
    {
      email: ['', [Validators.required, Validators.pattern(EMAIL_REGEX)]],
      password: ['', [Validators.required, Validators.pattern(PASSWORD_REGEX)]],
      confirmPassword: [''], // used only in signup mode
    },
    { validators: passwordsMatchWhen(() => this.isSignup()) }
  );

  get email() {
    return this.authForm.get('email');
  }
  get password() {
    return this.authForm.get('password');
  }
  get confirmPassword() {
    return this.authForm.get('confirmPassword');
  }

  readonly message = computed(() => (this.isSignup() ? UI.SIGNUP_WITH_MESSAGE : UI.LOGIN_MESSAGE));
  readonly submitLabel = computed(() => (this.isSignup() ? 'Sign up' : 'Log in'));
  readonly switchLine = computed(() => (this.isSignup() ? UI.GO_TO_LOGIN : UI.GO_TO_SIGNUP));

  readonly groupPasswordMismatch = computed(
    () => this.isSignup() && this.authForm.touched && this.authForm.hasError('passwordMismatch')
  );

  constructor() {
    this.syncConfirmValidators();
  }

  toggleMode(ev?: Event) {
    ev?.preventDefault();
    this.mode.update((m) => (m === 'signup' ? 'login' : 'signup'));

    const email = this.authForm.get('email')?.value;
    this.authForm.reset(); // clears everything
    this.authForm.patchValue({ email }); // restore email only

    this.syncConfirmValidators();
    this.authForm.updateValueAndValidity(); // refresh group validator
  }

  private syncConfirmValidators() {
    const ctrl = this.authForm.get('confirmPassword');
    if (!ctrl) return;
    if (this.isSignup()) {
      ctrl.setValidators([Validators.required]);
    } else {
      ctrl.clearValidators();
      ctrl.setValue(''); // clear stale value when leaving signup
    }
    ctrl.updateValueAndValidity();
  }

  submit() {
    this.authForm.markAllAsTouched();
    if (this.authForm.invalid) return;

    const { email, password } = this.authForm.value as { email: string; password: string };
    const mode = this.mode();

    const req$ = mode === 'signup'
      ? this.authService.signup({ email, password })
      : this.authService.login({ email, password });

    this.loading.set(true);
    this.errorMsg.set(null);    

    req$.pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: () => {
        // logged in / signed up successfully; `bootstrapSession()` will hydrate signals
        this.modalService.closeSignupLogin?.();      // if you use a modal
        // optionally navigate: this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        // friendly message; adjust as needed
        const msg = err?.error?.error || err?.message || 'Login failed';
        this.errorMsg.set(msg);
      }
    });
  }

  // Template helper
  hasError(path: string, error: string) {
    const c = this.authForm.get(path);
    return !!c && c.touched && c.hasError(error);
  }

  forgotPassword() {
    console.log("Forgot password");
  }
}
