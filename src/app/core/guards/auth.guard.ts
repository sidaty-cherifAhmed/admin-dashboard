import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

function checkAuth(redirectUrl: string): boolean | UrlTree {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: redirectUrl || '/' },
  });
  
}

export const authGuard: CanActivateFn = (_, state) => checkAuth(state.url);
export const authChildGuard: CanActivateChildFn = (_, state) => checkAuth(state.url);
