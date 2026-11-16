import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { EventCard } from './event-card';
import { EventPage } from './event-page';
import { GameChoicePage } from './game-choice-page';
import { eventDto, nextGameDto } from './test-data';

describe('pages events', () => {
  let http: HttpTestingController;

  function setup<T>(component: new (...args: never[]) => T, inputs: Record<string, unknown> = {}): ComponentFixture<T> {
    TestBed.configureTestingModule({
      imports: [component],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { me: () => ({ id: 'p-2', pseudo: 'Bruno', avatarUrl: '', role: 'player' }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(component);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture;
  }

  async function settle(fixture: ComponentFixture<unknown>): Promise<HTMLElement> {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
    return fixture.nativeElement as HTMLElement;
  }

  const button = (page: HTMLElement, text: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.trim() === text) as HTMLButtonElement;

  afterEach(() => http?.verify());

  it('montre le type d’un event et grise un event annulé', async () => {
    const fixture = setup(EventCard, { event: eventDto({ type: 'side', status: 'cancelled', timeline: 'past' }) });
    const page = await settle(fixture);

    expect(page.querySelector('app-event-type')?.textContent?.trim()).toBe('Side');
    expect(page.querySelector('a')?.className).toContain('grayscale');
    fixture.componentRef.setInput('event', eventDto());
    await settle(fixture);
    expect(page.querySelector('app-event-type')?.textContent?.trim()).toBe('Main');
    expect(page.querySelector('a')?.className).not.toContain('grayscale');
  });

  it('affiche un event en heure de Paris et inscrit le joueur', async () => {
    const fixture = setup(EventPage, { id: 'e-1' });
    http.expectOne('/api/events/e-1').flush(eventDto());
    const page = await settle(fixture);

    expect(page.textContent).toContain('Trackmania — Speedrun');
    expect(page.textContent).toContain('21 févr. 2026, 12:00');
    button(page, 'S’inscrire').click();
    http.expectOne({ method: 'POST', url: '/api/events/e-1/registrations' }).flush(eventDto({ registeredByMe: true }));
    await settle(fixture);

    expect(page.textContent).toContain('Tu es inscrit.');
    expect(button(page, 'S’inscrire')).toBeUndefined();
  });

  it('montre les résultats d’un event terminé, classés d’abord', async () => {
    const fixture = setup(EventPage, { id: 'e-1' });
    http.expectOne('/api/events/e-1').flush(
      eventDto({ status: 'finished', registrationOpen: false, results: [{ playerId: 'p-1', place: null }, { playerId: 'p-2', place: 1 }] }),
    );
    const page = await settle(fixture);

    const rows = [...page.querySelectorAll('li')].map((row) => row.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows).toEqual(['1Bruno', '—Alice']);
  });

  it('laisse le vainqueur choisir le prochain jeu', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = setup(GameChoicePage);
    http.expectOne('/api/game-choice').flush(nextGameDto());
    const page = await settle(fixture);

    expect(page.textContent).toContain('Bruno choisit le jeu du prochain main jusqu’au 4 févr. 2026, 12:00');
    page.querySelectorAll<HTMLButtonElement>('li button')[1].click();
    const choice = http.expectOne({ method: 'PUT', url: '/api/game-choice' });
    expect(choice.request.body).toEqual({ formatId: 'f-2' });
    choice.flush(nextGameDto({ status: 'chosen', canChoose: false, pick: nextGameDto().candidates[1] }));
    await settle(fixture);

    expect(page.textContent).toContain('Le jeu du prochain main est choisi');
    expect(page.querySelectorAll('li button')).toHaveLength(0);
  });
});
