import type { CatalogGame, GameCatalog } from '@porolympiques/domain';

export interface IgdbCredentials {
  /** Identifiants de l'application Twitch qui donne accès à IGDB. */
  clientId: string;
  clientSecret: string;
}

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const GAMES_URL = 'https://api.igdb.com/v4/games';
const COVER_URL = 'https://images.igdb.com/igdb/image/upload/t_cover_big';
const FIELDS = 'fields name,cover.image_id,first_release_date';
/**
 * Types de jeux proposés : jeu principal (0), extension autonome (4), remake (8), remaster (9), version enrichie (10)
 * et portage (11). Pas de DLC, de bundle, de mod ni d'épisode.
 */
const GAME_TYPES = '(0,4,8,9,10,11)';
/** Sans les éditions (collector, GOTY…), rattachées à leur jeu par `version_parent`. */
const WHERE = `where game_type = ${GAME_TYPES} & version_parent = null`;
const RESULT_LIMIT = 10;
/** IGDB accepte 4 requêtes par seconde : on les espace d'au moins 250 ms. */
const MIN_INTERVAL_MS = 250;
/** Marge avant l'expiration du jeton, pour ne pas l'utiliser à la dernière seconde. */
const TOKEN_MARGIN_MS = 60_000;
const TIMEOUT_MS = 5_000;

interface IgdbGame {
  id: number;
  name: string;
  cover?: { image_id?: string };
  /** Horodatage Unix, en secondes. */
  first_release_date?: number;
}

/**
 * Adapter IGDB du port `GameCatalog`. Appels côté serveur uniquement, avec un jeton d'application Twitch
 * gardé en mémoire et renouvelé avant son expiration (ou dès qu'IGDB le refuse).
 */
export class IgdbGameCatalog implements GameCatalog {
  private token: { value: string; expiresAt: number } | null = null;
  private pendingToken: Promise<string> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private lastCallAt = 0;

  constructor(
    private readonly credentials: IgdbCredentials,
    private readonly http: typeof fetch = (input, init) => fetch(input, init),
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async search(query: string): Promise<CatalogGame[]> {
    const text = query.replace(/["\\]/g, ' ').trim();
    if (!text) return [];
    const rows = await this.query(`search "${text}"; ${FIELDS}; ${WHERE}; limit ${RESULT_LIMIT};`);
    return rows.map(toCatalogGame);
  }

  async findById(externalId: string): Promise<CatalogGame | null> {
    if (!/^\d+$/.test(externalId)) return null;
    const [row] = await this.query(`${FIELDS}; where id = ${externalId}; limit 1;`);
    return row ? toCatalogGame(row) : null;
  }

  private async query(body: string): Promise<IgdbGame[]> {
    await this.waitTurn();
    return this.post(body, true);
  }

  private async post(body: string, retryOnUnauthorized: boolean): Promise<IgdbGame[]> {
    const token = await this.accessToken();
    const response = await this.http(GAMES_URL, {
      method: 'POST',
      headers: {
        'Client-ID': this.credentials.clientId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'text/plain',
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 401 && retryOnUnauthorized) {
      // Jeton révoqué ou expiré plus tôt que prévu : on en redemande un, une seule fois.
      this.token = null;
      return this.post(body, false);
    }
    if (!response.ok) throw new Error(`IGDB a répondu ${response.status} : ${await response.text()}`);
    return (await response.json()) as IgdbGame[];
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.now() < this.token.expiresAt - TOKEN_MARGIN_MS) return this.token.value;
    // Plusieurs recherches simultanées ne demandent qu'un seul jeton.
    this.pendingToken ??= this.fetchToken().finally(() => (this.pendingToken = null));
    return this.pendingToken;
  }

  private async fetchToken(): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
      grant_type: 'client_credentials',
    });
    const response = await this.http(`${TOKEN_URL}?${params}`, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Twitch a refusé le jeton IGDB (${response.status})`);
    const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
    this.token = { value: access_token, expiresAt: this.now() + expires_in * 1000 };
    return access_token;
  }

  /** File d'attente : chaque appel attend son tour, au moins 250 ms après le précédent. */
  private waitTurn(): Promise<void> {
    const turn = this.queue.then(async () => {
      const wait = this.lastCallAt + MIN_INTERVAL_MS - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastCallAt = this.now();
    });
    this.queue = turn.catch(() => undefined);
    return turn;
  }
}

function toCatalogGame(row: IgdbGame): CatalogGame {
  return {
    externalId: String(row.id),
    name: row.name,
    coverUrl: row.cover?.image_id ? `${COVER_URL}/${row.cover.image_id}.jpg` : null,
    year: row.first_release_date ? new Date(row.first_release_date * 1000).getUTCFullYear() : null,
  };
}
