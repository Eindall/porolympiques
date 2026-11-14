import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { IdeaDto } from '@porolympiques/shared';
import { AuthService } from '../core/auth.service';
import { IdeasPage } from './ideas-page';

export function idea(overrides: Partial<IdeaDto> = {}): IdeaDto {
  return {
    id: 'f-1',
    game: { id: 'g-1', source: 'igdb', name: 'The Witcher 3', coverUrl: null, priceTier: '10to30', canEdit: false },
    name: 'Speedrun any%',
    description: 'Le plus vite possible.',
    teamMode: 'solo',
    playMode: 'async',
    status: 'proposed',
    suggestedBy: { id: 'p-1', pseudo: 'Alice' },
    votes: 1,
    votedByMe: false,
    playedCount: 0,
    createdAt: '2026-11-13T12:00:00.000Z',
    canEdit: false,
    ...overrides,
  };
}

describe('IdeasPage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<IdeasPage>;

  async function render(ideas: IdeaDto[], role: 'admin' | 'player' = 'player'): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [IdeasPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { me: () => ({ id: 'p-2', pseudo: 'Bruno', avatarUrl: '', role }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(IdeasPage);
    fixture.detectChanges();
    http.expectOne('/api/ideas').flush(ideas);
    await settle();
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('affiche les idées avec leur jeu, leurs badges et leurs votes', async () => {
    const page = await render([
      idea({ votes: 3, playedCount: 2 }),
      idea({ id: 'f-2', name: 'Fallen Kingdom', status: 'selected', game: { id: 'g-2', source: 'custom', name: 'Minecraft', coverUrl: null, priceTier: 'gt30', canEdit: false } }),
    ]);

    const cards = page.querySelectorAll('app-idea-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('The Witcher 3');
    expect(cards[0].textContent).toContain('Speedrun any%');
    expect(cards[0].textContent).toContain('10 à 30 €');
    expect(cards[0].textContent).toContain('Joué 2 fois');
    expect(cards[0].textContent).toContain('Proposé par Alice');
    expect(cards[0].querySelector('[aria-pressed]')?.textContent).toContain('3');
    expect(cards[1].textContent).toContain('Retenu');
    expect(cards[1].querySelector<HTMLButtonElement>('[aria-pressed]')?.disabled).toBe(true);
    expect(page.textContent).not.toContain('Modifier');
    expect(page.textContent).not.toContain('Supprimer');
  });

  it('vote et retire son vote', async () => {
    const page = await render([idea()]);
    const button = () => page.querySelector<HTMLButtonElement>('[aria-pressed]') as HTMLButtonElement;

    button().click();
    http.expectOne({ method: 'PUT', url: '/api/ideas/f-1/vote' }).flush(idea({ votes: 2, votedByMe: true }));
    await settle();
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().textContent).toContain('2');

    button().click();
    http.expectOne({ method: 'DELETE', url: '/api/ideas/f-1/vote' }).flush(idea({ votes: 1, votedByMe: false }));
    await settle();
    expect(button().getAttribute('aria-pressed')).toBe('false');
  });

  it('affiche le refus du serveur', async () => {
    const page = await render([idea()]);

    page.querySelector<HTMLButtonElement>('[aria-pressed]')?.click();
    http
      .expectOne('/api/ideas/f-1/vote')
      .flush({ statusCode: 409, code: 'votes_frozen', message: 'Votes gelés.' }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(page.querySelector('[role=alert]')?.textContent).toContain('Votes gelés.');
  });

  it('filtre la liste', async () => {
    const page = await render([idea()]);
    const select = page.querySelector<HTMLSelectElement>('select[aria-label="Tranche de prix"]') as HTMLSelectElement;

    select.value = 'free';
    select.dispatchEvent(new Event('change'));
    http.expectOne('/api/ideas?priceTier=free').flush([]);
    await settle();

    expect(page.textContent).toContain('Aucune idée avec ces filtres');
  });

  const byText = (page: HTMLElement, text: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === text) as HTMLButtonElement;

  function typeInto(page: HTMLElement, selector: string, value: string): void {
    const field = page.querySelector<HTMLInputElement>(selector) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  it('laisse l’auteur modifier son idée, sans la tranche de prix ni la suppression', async () => {
    const page = await render([idea({ canEdit: true })]);

    expect(byText(page, 'Supprimer')).toBeUndefined();
    byText(page, 'Modifier').click();
    await settle();
    expect(page.querySelector('select[name=priceTier]')).toBeNull();
    expect(page.querySelector('input[name=gameName]')).toBeNull();
    typeInto(page, 'input[name=name]', 'Speedrun 100%');
    await settle();
    byText(page, 'Enregistrer').click();

    const patch = http.expectOne({ method: 'PATCH', url: '/api/ideas/f-1' });
    expect(patch.request.body).toEqual({ name: 'Speedrun 100%', description: 'Le plus vite possible.', teamMode: 'solo', playMode: 'async' });
    patch.flush(idea({ name: 'Speedrun 100%', canEdit: true }));
    await settle();
    expect(page.textContent).toContain('Speedrun 100%');
  });

  it('laisse le créateur d’un jeu saisi librement le renommer et changer son image', async () => {
    const custom = idea({ canEdit: true, game: { id: 'g-2', source: 'custom', name: 'Wikipedia', coverUrl: null, priceTier: 'free', canEdit: true } });
    const page = await render([custom]);

    byText(page, 'Modifier').click();
    await settle();
    typeInto(page, 'input[name=gameName]', 'Wikipédia');
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'jaquette.png', { type: 'image/png' });
    const input = page.querySelector<HTMLInputElement>('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await settle();
    byText(page, 'Enregistrer').click();

    const patch = http.expectOne({ method: 'PATCH', url: '/api/ideas/f-1' });
    expect(patch.request.body).toMatchObject({ gameName: 'Wikipédia' });
    patch.flush({ ...custom, game: { ...custom.game, name: 'Wikipédia' } });
    await settle();
    const upload = http.expectOne({ method: 'PUT', url: '/api/games/g-2/cover' });
    expect((upload.request.body as FormData).get('file')).toBe(file);
    upload.flush({ ...custom.game, name: 'Wikipédia', coverUrl: '/api/games/g-2/cover?v=abcd1234' });
    await settle();

    expect(page.querySelector('app-idea-card img')?.getAttribute('src')).toBe('/api/games/g-2/cover?v=abcd1234');
  });

  it('refuse une image d’un autre format avant tout envoi', async () => {
    const custom = idea({ canEdit: true, game: { id: 'g-2', source: 'custom', name: 'Wikipedia', coverUrl: null, priceTier: 'free', canEdit: true } });
    const page = await render([custom]);
    byText(page, 'Modifier').click();
    await settle();

    const input = page.querySelector<HTMLInputElement>('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['GIF89a'], 'anim.gif', { type: 'image/gif' })] });
    input.dispatchEvent(new Event('change'));
    await settle();

    expect(page.querySelector('[role=alert]')?.textContent).toContain('PNG, JPEG et WebP');
  });

  it('laisse l’admin corriger et supprimer une idée', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const page = await render([idea({ canEdit: true })], 'admin');

    byText(page, 'Modifier').click();
    await settle();
    const name = page.querySelector<HTMLInputElement>('input[name=name]') as HTMLInputElement;
    name.value = 'Speedrun 100%';
    name.dispatchEvent(new Event('input'));
    await settle();
    byText(page, 'Enregistrer').click();
    const patch = http.expectOne({ method: 'PATCH', url: '/api/ideas/f-1' });
    expect(patch.request.body).toMatchObject({ name: 'Speedrun 100%', priceTier: '10to30' });
    expect(patch.request.body).not.toHaveProperty('gameName');
    patch.flush(idea({ name: 'Speedrun 100%' }));
    await settle();
    expect(page.textContent).toContain('Speedrun 100%');

    byText(page, 'Supprimer').click();
    http.expectOne({ method: 'DELETE', url: '/api/ideas/f-1' }).flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    expect(page.querySelectorAll('app-idea-card')).toHaveLength(0);
  });
});
