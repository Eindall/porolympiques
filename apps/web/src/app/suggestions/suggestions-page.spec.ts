import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { SuggestionDto } from '@porolympiques/shared';
import { AuthService } from '../core/auth.service';
import { SuggestionsPage } from './suggestions-page';

const suggestion = (overrides: Partial<SuggestionDto> = {}): SuggestionDto => ({
  id: 'sg-1',
  title: 'Un classement par équipe',
  description: '',
  category: 'format',
  status: 'proposed',
  author: { id: 'p-1', pseudo: 'Alice' },
  upvotes: 0,
  downvotes: 0,
  score: 0,
  myVote: null,
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedAt: '2026-03-01T12:00:00.000Z',
  canEdit: false,
  canDelete: false,
  canVote: true,
  ...overrides,
});

describe('page des suggestions', () => {
  let http: HttpTestingController;

  function setup(role: 'player' | 'admin' = 'player'): ComponentFixture<SuggestionsPage> {
    TestBed.configureTestingModule({
      imports: [SuggestionsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { me: () => ({ id: 'p-2', pseudo: 'Bruno', avatarUrl: '', role }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SuggestionsPage);
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

  const button = (root: Element, label: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (item) => item.getAttribute('aria-label') === label || item.textContent?.trim() === label,
    ) as HTMLButtonElement;
  const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim();

  afterEach(() => http?.verify());

  function load(roadmap = { planned: [] as SuggestionDto[], done: [] as SuggestionDto[] }, list: SuggestionDto[] = []) {
    http.expectOne('/api/suggestions/roadmap').flush(roadmap);
    http.expectOne('/api/suggestions?status=proposed').flush(list);
  }

  it('montre la roadmap en deux colonnes, puis les suggestions proposées', async () => {
    const fixture = setup();
    load(
      { planned: [suggestion({ id: 'sg-2', title: 'Rappels Discord', status: 'planned', score: 3 })], done: [] },
      [suggestion({ score: 1 })],
    );
    const page = await settle(fixture);

    const columns = page.querySelectorAll('section')[0].querySelectorAll('.grid > div');
    expect(text(columns[0])).toContain('Rappels Discord');
    expect(text(columns[0])).toContain('Dans la roadmap');
    expect(text(columns[1])).toContain('Rien de livré pour l’instant.');
    expect(text(page.querySelectorAll('section')[1])).toContain('Un classement par équipe');
    expect(button(page, 'Ajouter à la roadmap')).toBeUndefined();
  });

  it('vote pour, change pour contre, puis retire le vote en recliquant', async () => {
    const fixture = setup();
    load(undefined, [suggestion()]);
    const page = await settle(fixture);

    button(page, 'Voter pour').click();
    const up = http.expectOne({ method: 'PUT', url: '/api/suggestions/sg-1/vote' });
    expect(up.request.body).toEqual({ value: 1 });
    up.flush(suggestion({ myVote: 1, upvotes: 1, score: 1 }));
    await settle(fixture);
    expect(button(page, 'Retirer mon vote pour').getAttribute('aria-pressed')).toBe('true');

    button(page, 'Voter contre').click();
    const down = http.expectOne({ method: 'PUT', url: '/api/suggestions/sg-1/vote' });
    expect(down.request.body).toEqual({ value: -1 });
    down.flush(suggestion({ myVote: -1, downvotes: 1, score: -1 }));
    await settle(fixture);

    button(page, 'Retirer mon vote contre').click();
    http.expectOne({ method: 'DELETE', url: '/api/suggestions/sg-1/vote' }).flush(suggestion());
    await settle(fixture);
    expect(button(page, 'Voter contre').getAttribute('aria-pressed')).toBe('false');
  });

  it('désactive le vote d’une suggestion livrée', async () => {
    const fixture = setup();
    load({ planned: [], done: [suggestion({ status: 'done', canVote: false })] });
    const page = await settle(fixture);

    expect(button(page, 'Voter pour').disabled).toBe(true);
    expect(text(page)).toContain('Aucune suggestion pour l’instant.');
  });

  it('propose une suggestion, puis recharge la liste', async () => {
    const fixture = setup();
    load();
    const page = await settle(fixture);

    button(page, 'Proposer une amélioration').click();
    await settle(fixture);
    const title = page.querySelector<HTMLInputElement>('input[name="title"]') as HTMLInputElement;
    title.value = 'Mode sombre';
    title.dispatchEvent(new Event('input'));
    const category = page.querySelector<HTMLSelectElement>('select[name="category"]') as HTMLSelectElement;
    category.value = category.options[1].value;
    category.dispatchEvent(new Event('change'));
    await settle(fixture);
    button(page, 'Proposer').click();

    const sent = http.expectOne({ method: 'POST', url: '/api/suggestions' });
    expect(sent.request.body).toEqual({ title: 'Mode sombre', description: '', category: 'site' });
    sent.flush(suggestion({ id: 'sg-3', title: 'Mode sombre', category: 'site' }));
    await settle(fixture);
    http.expectOne('/api/suggestions?status=proposed').flush([suggestion({ id: 'sg-3', title: 'Mode sombre', category: 'site', canEdit: true, canDelete: true })]);
    await settle(fixture);

    expect(page.querySelector('form')).toBeNull();
    expect(text(page)).toContain('Mode sombre');
    expect(button(page, 'Modifier')).toBeDefined();
  });

  it('laisse l’admin ajouter à la roadmap, ce qui recharge la roadmap et la liste', async () => {
    const fixture = setup('admin');
    load(undefined, [suggestion()]);
    const page = await settle(fixture);

    button(page, 'Ajouter à la roadmap').click();
    const sent = http.expectOne({ method: 'PUT', url: '/api/suggestions/sg-1/status' });
    expect(sent.request.body).toEqual({ status: 'planned' });
    sent.flush(suggestion({ status: 'planned' }));
    await settle(fixture);
    load({ planned: [suggestion({ status: 'planned' })], done: [] });
    await settle(fixture);

    expect(text(page.querySelectorAll('section')[0])).toContain('Un classement par équipe');
    expect(button(page, 'Marquer livrée')).toBeDefined();
  });
});
