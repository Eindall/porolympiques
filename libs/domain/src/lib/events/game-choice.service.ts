import type { Idea } from '../ideas/idea';
import type { IdeaRepository } from '../ideas/idea.repository';
import { compareIdeas } from '../ideas/ideas.service';
import type { Actor } from '../seasons/seasons.service';
import type { Event, EventSummary } from './event';
import { EventError } from './event-error';
import type { EventRepository } from './event.repository';

/** Le vainqueur du dernier main choisit parmi ce nombre de formats, les plus upvotés. */
export const CHOICE_CANDIDATES = 5;
/** Délai pour choisir, à partir de la clôture du main. */
export const CHOICE_DELAY_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * - `scheduled` : un main est déjà prévu ou en cours, rien à choisir ;
 * - `chosen` : le vainqueur a choisi, en attente de la création du main ;
 * - `open` : le vainqueur peut encore choisir, jusqu'à `deadline` ;
 * - `default` : pas de vainqueur précédent, ou délai passé : le format le plus upvoté passe.
 */
export type GameChoiceStatus = 'scheduled' | 'chosen' | 'open' | 'default';

export interface GameChoiceState {
  status: GameChoiceStatus;
  /** Le main prévu ou en cours (`scheduled`). */
  nextMain: EventSummary | null;
  /** Le dernier main terminé, dont le vainqueur choisit. */
  lastMain: Event | null;
  /** Les joueurs classés premiers du dernier main. */
  choosers: { id: string; pseudo: string }[];
  deadline: Date | null;
  /** Les formats proposés les plus upvotés, dans l'ordre de la boîte à idées. */
  candidates: Idea[];
  /** Le format du prochain main : le choix du vainqueur, sinon le plus upvoté. Rien tant qu'un main est prévu. */
  pick: Idea | null;
  /** Le joueur qui consulte peut choisir maintenant. */
  canChoose: boolean;
}

/**
 * Choix du jeu du prochain main : les classés premiers du dernier main terminé choisissent parmi les 5 formats
 * les plus upvotés, pendant 3 jours après sa clôture. Le premier choix enregistré compte (cas d'une équipe). Sans
 * choix, ou pour le tout premier main, le format le plus upvoté passe. Le choix retient le format (votes gelés).
 */
export class GameChoiceService {
  constructor(
    private readonly events: EventRepository,
    private readonly ideas: IdeaRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async state(viewer: Actor): Promise<GameChoiceState> {
    const [nextMain, lastMain, pendingId, ideas] = await Promise.all([
      this.events.openMain(),
      this.events.lastFinishedMain(),
      this.events.pendingChoiceId(),
      this.ideas.list(viewer.id, {}),
    ]);
    const candidates = ideas
      .filter((idea) => idea.status === 'proposed')
      .sort(compareIdeas)
      .slice(0, CHOICE_CANDIDATES);
    const choosers = lastMain ? await this.choosersOf(lastMain) : [];
    const deadline = lastMain?.finishedAt ? new Date(lastMain.finishedAt.getTime() + CHOICE_DELAY_DAYS * DAY_MS) : null;
    const base = { nextMain, lastMain, choosers, deadline, candidates, canChoose: false };

    if (nextMain) return { ...base, status: 'scheduled', pick: null };
    if (pendingId) {
      return { ...base, status: 'chosen', pick: ideas.find((idea) => idea.id === pendingId) ?? null };
    }
    if (deadline && choosers.length > 0 && this.now().getTime() < deadline.getTime()) {
      return {
        ...base,
        status: 'open',
        pick: null,
        canChoose: choosers.some((chooser) => chooser.id === viewer.id) && candidates.length > 0,
      };
    }
    return { ...base, status: 'default', pick: candidates[0] ?? null };
  }

  async choose(player: Actor, formatId: string): Promise<GameChoiceState> {
    const state = await this.state(player);
    if (state.status === 'chosen') throw new EventError('conflict', 'Le jeu du prochain main est déjà choisi.');
    if (state.status !== 'open') throw new EventError('closed', 'Il n’y a pas de choix de jeu en cours.');
    if (!state.choosers.some((chooser) => chooser.id === player.id)) {
      throw new EventError('forbidden', 'Seul le vainqueur du dernier main choisit le jeu.');
    }
    if (!state.candidates.some((candidate) => candidate.id === formatId)) {
      throw new EventError('invalid', `Choisis parmi les ${CHOICE_CANDIDATES} formats les plus upvotés.`);
    }
    if (!(await this.events.choose(formatId))) throw new EventError('conflict', 'Le jeu du prochain main est déjà choisi.');
    return this.state(player);
  }

  private async choosersOf(event: Event): Promise<{ id: string; pseudo: string }[]> {
    const [results, registrations] = await Promise.all([this.events.results(event.id), this.events.registrations(event.id)]);
    const winners = new Set(results.filter((result) => result.place === 1).map((result) => result.playerId));
    return registrations
      .filter((registration) => winners.has(registration.playerId))
      .map(({ playerId, pseudo }) => ({ id: playerId, pseudo }));
  }
}
