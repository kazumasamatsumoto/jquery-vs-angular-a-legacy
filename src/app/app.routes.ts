import { Routes } from '@angular/router';
import { HomePage } from './pages/home';

export const routes: Routes = [
  { path: '', component: HomePage, title: 'トップ' },
  { path: 'legacy-naive', loadComponent: () => import('./pages/legacy-naive').then((m) => m.LegacyNaivePage), title: 'A: 無理やり' },
  { path: 'legacy-wrapped', loadComponent: () => import('./pages/legacy-wrapped').then((m) => m.LegacyWrappedPage), title: 'A: 包む' },
];
