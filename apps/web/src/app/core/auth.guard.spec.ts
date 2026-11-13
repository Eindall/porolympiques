import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, type RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';

const ME = { id: 'p-1', pseudo: 'Alice', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png', role: 'player' };

function run(guard: typeof authGuard): Promise<unknown> {
  return TestBed.runInInjectionContext(
    () => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Promise<unknown>,
  );
}

describe('gardes de connexion', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('laisse passer un joueur connecté', async () => {
    const result = run(authGuard);
    http.expectOne('/api/me').flush(ME);

    expect(await result).toBe(true);
  });

  it('renvoie sur /login sans session', async () => {
    const result = run(authGuard);
    http.expectOne('/api/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    const tree = await result;
    expect(tree).toBeInstanceOf(UrlTree);
    expect(String(tree)).toBe('/login');
  });

  it('renvoie un joueur déjà connecté de /login vers l’accueil', async () => {
    const result = run(guestGuard);
    http.expectOne('/api/me').flush(ME);

    expect(String(await result)).toBe('/');
  });

  it('laisse un visiteur sans session sur /login', async () => {
    const result = run(guestGuard);
    http.expectOne('/api/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await result).toBe(true);
  });
});
