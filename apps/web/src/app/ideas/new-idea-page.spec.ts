import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { GameSearchResultDto } from '@porolympiques/shared';
import { idea } from './ideas-page.spec';
import { NewIdeaPage, SEARCH_DEBOUNCE_MS } from './new-idea-page';

const witcher: GameSearchResultDto = {
  gameId: null,
  source: 'igdb',
  externalId: '1942',
  name: 'The Witcher 3',
  coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg',
  year: 2015,
  priceTier: null,
};

describe('NewIdeaPage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<NewIdeaPage>;
  let page: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    TestBed.configureTestingModule({
      imports: [NewIdeaPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(NewIdeaPage);
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function type(selector: string, value: string): void {
    const field = page.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  /** Bouton radio par son groupe et le texte de son libellé, comme le voit le joueur. */
  const radio = (name: string, label: string) =>
    [...page.querySelectorAll<HTMLInputElement>(`input[name=${name}]`)].find(
      (input) => input.closest('label')?.textContent?.trim() === label,
    ) as HTMLInputElement;

  const button = (text: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.includes(text)) as HTMLButtonElement;

  async function search(query: string, results: GameSearchResultDto[], catalogAvailable = true): Promise<void> {
    type('input[role=combobox]', query);
    fixture.detectChanges();
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    http.expectOne(`/api/catalog/games?q=${encodeURIComponent(query)}`).flush({ results, catalogAvailable });
    await settle();
  }

  it('attend la fin de la frappe avant de chercher, et pas en dessous de 2 caractères', async () => {
    type('input[role=combobox]', 'w');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    http.expectNone(() => true);

    type('input[role=combobox]', 'wi');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    type('input[role=combobox]', 'wit');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    http.expectOne('/api/catalog/games?q=wit').flush({ results: [witcher], catalogAvailable: true });
    await settle();

    expect(page.querySelector('[role=listbox]')?.textContent).toContain('The Witcher 3');
  });

  it('propose un format sur un jeu du catalogue, avec sa tranche de prix', async () => {
    await search('witcher', [witcher]);
    button('The Witcher 3').click();
    await settle();
    expect(page.querySelector('[data-testid=chosen-game]')?.textContent).toContain('The Witcher 3');

    radio('priceTier', '10 à 30 €').click();
    type('input[name=name]', 'Speedrun any%');
    type('textarea[name=description]', 'Le plus vite possible.');
    radio('playMode', 'Live').click();
    await settle();
    button('Proposer').click();

    const post = http.expectOne({ method: 'POST', url: '/api/ideas' });
    expect(post.request.body).toEqual({
      game: { kind: 'catalog', externalId: '1942' },
      priceTier: '10to30',
      name: 'Speedrun any%',
      description: 'Le plus vite possible.',
      teamMode: 'solo',
      playMode: 'live',
    });
    post.flush(idea());
    await settle();
    expect(navigate).toHaveBeenCalledWith('/idees');
  });

  it('montre les formats déjà proposés pour un jeu enregistré, sans redemander sa tranche', async () => {
    await search('witcher', [{ ...witcher, gameId: 'g-1', priceTier: 'lt10' }]);
    button('The Witcher 3').click();
    http.expectOne('/api/ideas?gameId=g-1').flush([idea({ votes: 3 })]);
    await settle();

    expect(page.querySelector('[data-testid=existing-formats]')?.textContent).toContain('Speedrun any% · 3 votes');
    expect(page.textContent).toContain('Moins de 10 €');
    expect(page.querySelector('input[name=priceTier]')).toBeNull();

    type('input[name=name]', 'Mort subite');
    await settle();
    button('Proposer').click();
    const post = http.expectOne({ method: 'POST', url: '/api/ideas' });
    expect(post.request.body).toMatchObject({ game: { kind: 'existing', gameId: 'g-1' }, priceTier: null });
    post.flush(idea());
    await settle();
  });

  function pickFile(file: File): void {
    const input = page.querySelector<HTMLInputElement>('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
  }

  const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'jaquette.png', { type: 'image/png' });
  const customIdea = (canEdit: boolean) =>
    idea({ game: { id: 'g-9', source: 'custom', name: 'Archipelago', coverUrl: null, priceTier: 'free', canEdit } });

  async function suggestCustomWithCover(): Promise<void> {
    await search('Archipelago', []);
    button('Ajouter « Archipelago » à la main').click();
    await settle();
    pickFile(png());
    radio('priceTier', 'Gratuit').click();
    type('input[name=name]', 'Multiworld');
    await settle();
    button('Proposer').click();
  }

  it('n’affiche le choix d’image que pour un jeu saisi à la main', async () => {
    await search('witcher', [witcher]);
    button('The Witcher 3').click();
    await settle();

    expect(page.querySelector('input[type=file]')).toBeNull();
  });

  it('envoie l’image d’un jeu saisi à la main une fois l’idée créée', async () => {
    await suggestCustomWithCover();

    http.expectOne({ method: 'POST', url: '/api/ideas' }).flush(customIdea(true));
    await settle();
    const upload = http.expectOne({ method: 'PUT', url: '/api/games/g-9/cover' });
    expect((upload.request.body as FormData).get('file')).toBeInstanceOf(File);
    upload.flush({ ...customIdea(true).game, coverUrl: '/api/games/g-9/cover?v=abcd1234' });
    await settle();

    expect(navigate).toHaveBeenCalledWith('/idees');
  });

  it('prévient si l’idée est enregistrée mais pas l’image', async () => {
    await suggestCustomWithCover();

    http.expectOne({ method: 'POST', url: '/api/ideas' }).flush(customIdea(true));
    await settle();
    http
      .expectOne('/api/games/g-9/cover')
      .flush({ statusCode: 415, code: 'unsupported_file', message: 'Image refusée : seuls les PNG, JPEG et WebP sont acceptés.' }, { status: 415, statusText: 'Unsupported Media Type' });
    await settle();

    expect(page.querySelector('[role=alert]')?.textContent).toContain('Ton idée est enregistrée, mais pas l’image');
    expect(page.querySelector('form')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('n’envoie pas d’image pour un jeu déjà ajouté par quelqu’un d’autre', async () => {
    await suggestCustomWithCover();

    http.expectOne({ method: 'POST', url: '/api/ideas' }).flush(customIdea(false));
    await settle();

    http.expectNone('/api/games/g-9/cover');
    expect(page.querySelector('[role=alert]')?.textContent).toContain('son image est gérée par celui qui l’a ajouté');
  });

  it('accepte un jeu hors catalogue, et demande alors sa tranche de prix', async () => {
    await search('Archipelago', [], false);
    expect(page.textContent).toContain('Le catalogue de jeux ne répond pas');

    button('Ajouter « Archipelago » à la main').click();
    await settle();
    type('input[name=name]', 'Multiworld');
    await settle();
    button('Proposer').click();
    await settle();
    expect(page.querySelector('[role=alert]')?.textContent).toContain('tranche de prix');
    http.expectNone({ method: 'POST', url: '/api/ideas' });

    radio('priceTier', 'Gratuit').click();
    await settle();
    button('Proposer').click();
    const post = http.expectOne({ method: 'POST', url: '/api/ideas' });
    expect(post.request.body).toMatchObject({ game: { kind: 'custom', name: 'Archipelago' }, priceTier: 'free', name: 'Multiworld' });
    post.flush({ statusCode: 409, code: 'duplicate', message: 'Ce format existe déjà pour ce jeu : upvote-le plutôt !' }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(page.querySelector('[role=alert]')?.textContent).toContain('existe déjà');
    expect(navigate).not.toHaveBeenCalled();
  });
});
