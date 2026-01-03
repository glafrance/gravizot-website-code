// src/app/app.routes.ts
import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Example routes; adjust to your app
  { path: '', loadComponent: () => import('./pages/home/home').then(m => m.HomePage) },
  { path: 'home', loadComponent: () => import('./pages/home/home').then(m => m.HomePage) },
  { path: '**', redirectTo: '' }
];
