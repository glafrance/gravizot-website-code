import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

import { AppHeader } from './components/app-header/app-header';
import { ModalService } from './core/services/modal.service';
import { SignupLogin } from './modals/signup-login/signup-login';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [AppHeader, CommonModule, RouterOutlet, SignupLogin]
})
export class App {
  public modalService = inject(ModalService);

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event) {
    this.modalService.closeSignupLogin();
  }
}
