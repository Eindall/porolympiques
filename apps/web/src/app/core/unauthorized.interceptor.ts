import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Une réponse 401 en cours de navigation (session expirée, révoquée, ou départ du serveur) renvoie sur /login.
 * `/api/me` est laissé au garde, qui décide lui-même où aller.
 */
export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.endsWith('/api/me')) {
        auth.clear();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
