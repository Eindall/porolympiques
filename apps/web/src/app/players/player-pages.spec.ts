import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { SeasonDto, SeasonSummaryDto, StandingsEntryDto } from '@porolympiques/shared';
import { AuthService } from '../core/auth.service';
import { eventDto } from '../events/test-data';
import { EventsPage } from '../events/events-page';
import { HomePage } from '../home/home-page';
import { StandingsPage } from '../standings/standings-page';
import { HallOfFamePage } from './hall-of-fame-page';
import { PlayerPage } from './player-page';

const summary = (overrides: Partial<SeasonSummaryDto> = {}): SeasonSummaryDto => ({
  id: 's-1',
  name: 'Saison 1',
  status: 'active',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-07-01T00:00:00.000Z',
  mainQuota: 3,
  sideQuota: 2,
  ...overrides,
});
const season = (overrides: Partial<SeasonDto> = {}): SeasonDto => ({ ...summary(), scoringScale: { 1: 24 }, ...overrides });

const entry = (rank: number, pseudo: string, overrides: Partial<StandingsEntryDto> = {}): StandingsEntryDto => ({
  rank,
  player: { id: `p-${pseudo}`, pseudo, avatarUrl: '', active: true },
  score: 50 - rank,
  wins: 0,
  results: [],
  ...overrides,
});

describe('pages joueur', () => {
  let http: HttpTestingController;

  function setup<T>(component: new (...args: never[]) => T, inputs: Record<string, unknown> = {}): ComponentFixture<T> {
    TestBed.configureTestingModule({
      imports: [component],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { me: () => ({ id: 'p-Alice', pseudo: 'Alice', avatarUrl: '', role: 'player' }) } },
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

  const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  afterEach(() => http?.verify());

  it('montre sur l’accueil les events en cours, le prochain et le top 5', async () => {
    const fixture = setup(HomePage);
    http.expectOne('/api/home').flush({
      ongoing: [eventDto()],
      next: eventDto({ id: 'e-2', timeline: 'upcoming', format: { ...eventDto().format, name: 'Course libre' } }),
      season: summary(),
      top: [entry(1, 'Alice'), entry(2, 'Bruno')],
    });
    const page = await settle(fixture);

    const sections = page.querySelectorAll('section');
    expect(text(sections[0])).toContain('Trackmania — Speedrun');
    expect(text(sections[1])).toContain('Prochain event');
    expect(text(sections[1])).toContain('Annonce le');
    expect([...sections[2].querySelectorAll('li a')].map(text)).toEqual(['Alice', 'Bruno']);
  });

  it('affiche le classement de la saison en cours, écartés en grisé, et change de saison', async () => {
    const fixture = setup(StandingsPage);
    http.expectOne('/api/seasons').flush([season({ id: 's-2', name: 'Saison 2', status: 'upcoming' }), season()]);
    await settle(fixture);
    const result = { eventId: 'e', label: 'Tetris', type: 'main' as const, endDate: '2026-02-01T00:00:00.000Z', place: 4, points: 12 };
    http.expectOne('/api/seasons/s-1/standings').flush({
      season: summary(),
      entries: [entry(1, 'Alice', { results: [{ ...result, status: 'counted' }, { ...result, eventId: 'f', place: 9, points: 2, status: 'discarded' }] })],
    });
    const page = await settle(fixture);

    const chips = page.querySelectorAll('li li');
    expect(text(chips[0])).toBe('Main Tetris · 4e · 12 pts');
    expect(chips[0].className).toContain('indigo');
    expect(chips[1].className).toContain('line-through');
    expect(page.textContent).toContain('les 3 meilleurs mains et les 2 meilleurs sides comptent');

    const picker = page.querySelector<HTMLSelectElement>('select[aria-label=Saison]') as HTMLSelectElement;
    picker.value = 's-2';
    picker.dispatchEvent(new Event('change'));
    http.expectOne('/api/seasons/s-2/standings').flush({ season: summary({ id: 's-2', name: 'Saison 2' }), entries: [] });
    expect(text(await settle(fixture))).toContain('Aucun résultat pour l’instant.');
  });

  it('range les events en cours, à venir et passés', async () => {
    const fixture = setup(EventsPage);
    http.expectOne('/api/seasons').flush([season()]);
    await settle(fixture);
    http.expectOne('/api/seasons/s-1/events').flush([
      eventDto({ id: 'a', timeline: 'past', status: 'finished', format: { ...eventDto().format, name: 'Ancien' } }),
      eventDto({ id: 'b', timeline: 'past', status: 'cancelled', format: { ...eventDto().format, name: 'Annulé' } }),
      eventDto({ id: 'c', timeline: 'ongoing' }),
    ]);
    const page = await settle(fixture);

    const [ongoing, upcoming, past] = [...page.querySelectorAll('section')];
    expect(text(ongoing)).toContain('Trackmania — Speedrun');
    expect(text(upcoming)).toContain('Rien d’annoncé pour la suite.');
    expect([...past.querySelectorAll('li')].map((li) => text(li.querySelector('p.truncate')))).toEqual([
      'Trackmania — Annulé',
      'Trackmania — Ancien',
    ]);
  });

  it('montre les trophées, médailles et saisons d’un joueur', async () => {
    const fixture = setup(PlayerPage, { id: 'p-Alice' });
    await settle(fixture);
    const result = { eventId: 'e-1', label: 'Tetris', type: 'main' as const, endDate: '2026-02-01T00:00:00.000Z', place: 1, points: 24, status: 'counted' as const };
    http.expectOne('/api/players/p-Alice').flush({
      player: { id: 'p-Alice', pseudo: 'Alice', avatarUrl: '', active: true },
      seasons: [{ season: summary({ status: 'finished' }), rank: 1, score: 24, results: [result] }],
      medals: [
        { seasonId: 's-1', eventId: 'e-1', label: 'Tetris', type: 'main', place: 1, endDate: result.endDate },
        { seasonId: 's-1', eventId: 'e-2', label: 'Fall Guys', type: 'side', place: 2, endDate: result.endDate },
      ],
      trophies: [summary({ status: 'finished' })],
    });
    const page = await settle(fixture);

    expect(page.textContent).toContain('🏆 Champion · Saison 1');
    expect(text(page.querySelector('[aria-label=Palmarès]'))).toContain('🥇 1 · 🥈 0 · 🥉 0 · 1 podium en side');
    expect([...page.querySelectorAll('[role=img]')].map((medal) => medal.getAttribute('aria-label'))).toEqual([
      'Médaille or',
      'Médaille argent (side)',
    ]);
    expect(page.textContent).toContain('1er · 24 pts');
  });

  it('affiche le palmarès, ou son absence', async () => {
    const fixture = setup(HallOfFamePage);
    http.expectOne('/api/hall-of-fame').flush({
      seasons: [{ season: summary({ status: 'finished' }), podium: [entry(1, 'Alice'), entry(1, 'Bruno'), entry(3, 'Chloé')] }],
    });
    const page = await settle(fixture);

    expect([...page.querySelectorAll('li')].map((li) => text(li.querySelector('a')))).toEqual(['Alice', 'Bruno', 'Chloé']);
    expect([...page.querySelectorAll('li [role=img]')].map((icon) => icon.textContent)).toEqual(['🏆', '🏆', '🥉']);
  });
});
