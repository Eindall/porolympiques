import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { MeDto } from '@porolympiques/shared';
import { firstValueFrom } from 'rxjs';

/** Le joueur connecté. La session vit dans un cookie httpOnly : le front ne voit jamais le jeton. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly me = signal<MeDto | null>(null);

  /** Charge le joueur connecté, ou `null` sans session valide. Les autres erreurs remontent. */
  async load(): Promise<MeDto | null> {
    try {
      const me = await firstValueFrom(this.http.get<MeDto>('/api/me'));
      this.me.set(me);
      return me;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.me.set(null);
        return null;
      }
      throw error;
    }
  }

  /** Session perdue (expirée, révoquée, départ du serveur) : on oublie le joueur. */
  clear(): void {
    this.me.set(null);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', null));
    } finally {
      this.clear();
      await this.router.navigateByUrl('/login');
    }
  }
}
