import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();
  const isAuthEndpoint = req.url.includes('/auth');

  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;


  return next(authReq).pipe(
                catchError((error: unknown) => {
                  if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthEndpoint) {
                          authService.logout();
                          if (router.url !== '/login') {
                               void router.navigate(['/login'], {
                               queryParams: { returnUrl: router.url || '/' },
                            });
                          }
                  }

                  return throwError(() => error);
    }),
  );
};
