import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { unauthorizedInterceptor } from './unauthorized.interceptor';

describe('unauthorizedInterceptor', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([unauthorizedInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    TestBed.inject(AuthService).me.set({ id: 'p-1', pseudo: 'Alice', avatarUrl: 'x', role: 'player' });
  });

  it('renvoie sur /login et oublie le joueur quand la session est perdue', async () => {
    const request = firstValueFrom(TestBed.inject(HttpClient).get('/api/events'));
    http.expectOne('/api/events').flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(request).rejects.toBeTruthy();
    expect(navigate).toHaveBeenCalledWith('/login');
    expect(TestBed.inject(AuthService).me()).toBeNull();
  });

  it('laisse /api/me au garde', async () => {
    const request = firstValueFrom(TestBed.inject(HttpClient).get('/api/me'));
    http.expectOne('/api/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(request).rejects.toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
