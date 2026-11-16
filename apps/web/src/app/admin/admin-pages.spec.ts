import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { SeasonDto } from '@porolympiques/shared';
import { AuthService } from '../core/auth.service';
import { eventDto, nextGameDto } from '../events/test-data';
import { idea } from '../ideas/test-data';
import { AdminEventPage } from './admin-event-page';
import { AdminPage, parseScale, scaleText } from './admin-page';

const season = (overrides: Partial<SeasonDto> = {}): SeasonDto => ({
  id: 's-1',
  name: 'Saison 1',
  status: 'active',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-07-01T00:00:00.000Z',
  scoringScale: { 1: 24, 2: 18 },
  mainQuota: 3,
  sideQuota: 2,
  ...overrides,
});

describe('pages admin', () => {
  let http: HttpTestingController;

  function setup<T>(component: new (...args: never[]) => T, inputs: Record<string, unknown> = {}): ComponentFixture<T> {
    TestBed.configureTestingModule({
      imports: [component],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { me: () => ({ id: 'p-9', pseudo: 'Tong', avatarUrl: '', role: 'admin' }) } },
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

  function type(page: HTMLElement, selector: string, value: string): void {
    const field = page.querySelector<HTMLInputElement>(selector) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input'));
  }

  const button = (page: HTMLElement, text: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.trim() === text) as HTMLButtonElement;

  afterEach(() => http?.verify());

  it('lit et écrit un barème en liste', () => {
    expect(parseScale('24, 18;14 2')).toEqual({ 1: 24, 2: 18, 3: 14, 4: 2 });
    expect(parseScale('24, x')).toBeNull();
    expect(parseScale('')).toBeNull();
    expect(scaleText({ 2: 18, 1: 24, 10: 1 })).toBe('24, 18, 1');
  });

  async function adminPage() {
    const fixture = setup(AdminPage);
    http.expectOne('/api/seasons').flush([season()]);
    http.expectOne('/api/players').flush([{ id: 'p-1', pseudo: 'Alice', avatarUrl: '', active: true }]);
    http.expectOne('/api/ideas').flush([idea({ id: 'f-1', name: 'Speedrun' }), idea({ id: 'f-2', name: 'Course libre' })]);
    http.expectOne('/api/game-choice').flush(nextGameDto({ status: 'default', canChoose: false, pick: idea({ id: 'f-2', name: 'Course libre' }) }));
    await settle(fixture);
    http.expectOne('/api/seasons/s-1/events').flush([eventDto()]);
    return { fixture, page: await settle(fixture) };
  }

  it('crée une saison avec les dates lues en heure de Paris', async () => {
    const { fixture, page } = await adminPage();

    expect(page.textContent).toContain('Trackmania — Speedrun');
    type(page, 'input[name=seasonName]', 'Saison 2');
    type(page, 'input[name=seasonStart]', '2026-07-01T00:00');
    type(page, 'input[name=seasonEnd]', '2027-01-01T00:00');
    await settle(fixture);
    button(page, 'Créer la saison').click();

    const created = http.expectOne({ method: 'POST', url: '/api/admin/seasons' });
    expect(created.request.body).toEqual({
      name: 'Saison 2',
      startDate: '2026-06-30T22:00:00.000Z',
      endDate: '2026-12-31T23:00:00.000Z',
      scoringScale: { 1: 24, 2: 18, 3: 14, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2 },
      mainQuota: 3,
      sideQuota: 2,
    });
    created.flush(season({ id: 's-2', name: 'Saison 2', status: 'upcoming' }));
    await settle(fixture);
    http.expectOne('/api/seasons/s-2/events').flush([]);
  });

  it('préremplit un main avec le format choisi ou le plus upvoté', async () => {
    const { fixture, page } = await adminPage();
    type(page, 'input[name=announceDate]', '2026-03-01T10:00');
    type(page, 'input[name=registrationEnd]', '2026-03-20T20:00');
    type(page, 'input[name=endDate]', '2026-03-31T20:00');
    await settle(fixture);
    button(page, 'Créer l’event').click();

    const created = http.expectOne({ method: 'POST', url: '/api/admin/events' });
    expect(created.request.body).toMatchObject({ seasonId: 's-1', type: 'main', format: { kind: 'existing', formatId: 'f-2' }, liveDate: null, hostId: null });
    created.flush(eventDto());
    await settle(fixture);
    http.expectOne('/api/seasons/s-1/events').flush([eventDto()]);
    http.expectOne('/api/ideas').flush([]);
    http.expectOne('/api/game-choice').flush(nextGameDto({ status: 'scheduled' }));
  });

  async function eventPage(event = eventDto()) {
    const fixture = setup(AdminEventPage, { id: 'e-1' });
    http.expectOne('/api/events/e-1').flush(event);
    http.expectOne('/api/players').flush([]);
    http.expectOne('/api/ideas').flush([]);
    return { fixture, page: await settle(fixture) };
  }

  it('saisit les places d’un event solo, une place vide laissant non classé', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { fixture, page } = await eventPage();

    type(page, 'input[aria-label="Place de Alice"]', '1');
    await settle(fixture);
    button(page, 'Enregistrer les places et clore l’event').click();

    const saved = http.expectOne({ method: 'PUT', url: '/api/admin/events/e-1/results' });
    expect(saved.request.body).toEqual({ players: [{ playerId: 'p-1', place: 1 }, { playerId: 'p-2', place: null }] });
    saved.flush(eventDto({ status: 'finished', results: [{ playerId: 'p-1', place: 1 }, { playerId: 'p-2', place: null }] }));
    const after = await settle(fixture);
    expect(button(after, 'Corriger les places')).toBeDefined();
  });

  it('range les inscrits dans les équipes et saisit une place par équipe', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const team = eventDto({
      format: { id: 'f-1', name: 'Relais', description: '', teamMode: 'team', playMode: 'async' },
      teams: [{ id: 't-1', name: 'Bleus' }],
    });
    const { fixture, page } = await eventPage(team);

    type(page, 'select[aria-label="Équipe de Alice"]', 't-1');
    http.expectOne({ method: 'PUT', url: '/api/admin/events/e-1/registrations/p-1/team' }).flush(team);
    await settle(fixture);
    type(page, 'input[aria-label="Place de l’équipe Bleus"]', '2');
    await settle(fixture);
    button(page, 'Enregistrer les places et clore l’event').click();

    expect(http.expectOne('/api/admin/events/e-1/results').request.body).toEqual({ teams: [{ teamId: 't-1', place: 2 }] });
  });

  it('affiche les avertissements d’un side et le valide', async () => {
    const side = eventDto({ type: 'side', sideWarnings: ['Annoncé moins d’une semaine avant d’être joué.'] });
    const { fixture, page } = await eventPage(side);

    expect(page.textContent).toContain('Annoncé moins d’une semaine');
    const box = page.querySelector<HTMLInputElement>('input[type=checkbox]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    const validation = http.expectOne({ method: 'PUT', url: '/api/admin/events/e-1/validated' });
    expect(validation.request.body).toEqual({ validated: true });
    validation.flush({ ...side, validated: true });
    await settle(fixture);
  });
});
