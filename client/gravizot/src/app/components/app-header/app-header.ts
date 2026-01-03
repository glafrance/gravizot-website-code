import { Component, inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { RouterLink } from '@angular/router';

import { Gravizot } from '../../shared/components/gravizot/gravizot';
import { ModalService } from '../../core/services/modal.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [Gravizot, RouterLink],
  templateUrl: './app-header.html',
  styleUrls: ['./app-header.scss']
})
export class AppHeader {
  logoClass = 'gravizot';
  private modalService = inject(ModalService);
  private authService = inject(AuthService);
  isLoggedIn = this.authService.isLoggedIn;
  loading = false;
  errorMsg: string | null = null;

  logout() {
    this.loading = true;
    this.errorMsg = null;

    this.authService.logout().pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: () => {
        // signals in AuthService are already cleared in .tap()
        // optional: this.router.navigateByUrl('/');
      },
      error: (err) => {
        this.errorMsg = err?.error?.error || err?.message || 'Logout failed';
      }
    });
  }

  openSignupDialog() {
    this.modalService.openSignupLogin();
  }
}
