import type { Actor } from '../seasons/seasons.service';
import {
  SUGGESTION_CATEGORIES,
  SUGGESTION_DESCRIPTION_MAX,
  SUGGESTION_STATUSES,
  SUGGESTION_TITLE_MAX,
  type SuggestionCategory,
  type SuggestionChanges,
  type SuggestionDetail,
  type SuggestionFilters,
  type SuggestionStatus,
  type SuggestionView,
  type SuggestionVoteValue,
} from './suggestion';
import { SuggestionError } from './suggestion-error';
import type { SuggestionRepository } from './suggestion.repository';

export interface SuggestionInput {
  title: string;
  description?: string;
  category: SuggestionCategory;
}

export type SuggestionUpdate = Partial<SuggestionInput>;

/** La roadmap : ce qui est prévu (par score) et ce qui est livré (les plus récentes d'abord). */
export interface Roadmap {
  planned: SuggestionView[];
  done: SuggestionView[];
}

const isAdmin = (actor: Actor) => actor.role === 'admin';

/** Modifier ou supprimer : l'admin toujours, l'auteur tant que la suggestion n'est pas dans la roadmap. */
export function canEditSuggestion(actor: Actor, suggestion: Pick<SuggestionDetail, 'authorId' | 'status'>): boolean {
  return isAdmin(actor) || (suggestion.authorId === actor.id && suggestion.status === 'proposed');
}

/** On vote tant que la suggestion n'est pas livrée. */
export function canVoteSuggestion(suggestion: Pick<SuggestionDetail, 'status'>): boolean {
  return suggestion.status !== 'done';
}

export function scoreOf(suggestion: Pick<SuggestionDetail, 'upvotes' | 'downvotes'>): number {
  return suggestion.upvotes - suggestion.downvotes;
}

/** Ordre de la liste : meilleur score d'abord, puis les plus anciennes. */
export function compareSuggestions(a: SuggestionDetail, b: SuggestionDetail): number {
  return scoreOf(b) - scoreOf(a) || a.createdAt.getTime() - b.createdAt.getTime() || a.title.localeCompare(b.title, 'fr');
}

export function suggestionView(suggestion: SuggestionDetail, viewer: Actor): SuggestionView {
  const canEdit = canEditSuggestion(viewer, suggestion);
  return { ...suggestion, score: scoreOf(suggestion), canEdit, canDelete: canEdit, canVote: canVoteSuggestion(suggestion) };
}

/**
 * Suggestions d'amélioration du format, du site, du bot ou de l'organisation. Chacun vote pour ou contre ;
 * l'admin pioche dedans pour la roadmap (`planned`), puis marque livré (`done`). L'auteur modifie ou supprime
 * sa suggestion tant qu'elle n'est pas dans la roadmap ; une suggestion livrée a ses votes figés.
 */
export class SuggestionsService {
  constructor(private readonly suggestions: SuggestionRepository) {}

  async list(viewer: Actor, filters: SuggestionFilters = {}): Promise<SuggestionView[]> {
    return (await this.suggestions.list(viewer.id, filters)).sort(compareSuggestions).map((item) => suggestionView(item, viewer));
  }

  async roadmap(viewer: Actor): Promise<Roadmap> {
    const [planned, done] = await Promise.all([this.list(viewer, { status: 'planned' }), this.list(viewer, { status: 'done' })]);
    done.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return { planned, done };
  }

  async get(viewer: Actor, id: string): Promise<SuggestionView> {
    return suggestionView(await this.find(id, viewer), viewer);
  }

  async propose(author: Actor, input: SuggestionInput): Promise<SuggestionView> {
    const created = await this.suggestions.create({
      authorId: author.id,
      title: requireTitle(input.title),
      description: cleanDescription(input.description ?? ''),
      category: requireCategory(input.category),
    });
    return this.get(author, created.id);
  }

  async update(actor: Actor, id: string, update: SuggestionUpdate): Promise<SuggestionView> {
    const suggestion = await this.find(id, actor);
    if (!canEditSuggestion(actor, suggestion)) {
      throw new SuggestionError('forbidden', 'Seul l’admin modifie une suggestion qui est dans la roadmap ou livrée, ou celle d’un autre.');
    }
    const changes: SuggestionChanges = {};
    if (update.title !== undefined) changes.title = requireTitle(update.title);
    if (update.description !== undefined) changes.description = cleanDescription(update.description);
    if (update.category !== undefined) changes.category = requireCategory(update.category);
    if (Object.keys(changes).length > 0) await this.suggestions.update(id, changes);
    return this.get(actor, id);
  }

  /** Pose ou change le vote ; `null` le retire. */
  async vote(player: Actor, id: string, value: SuggestionVoteValue | null): Promise<SuggestionView> {
    const suggestion = await this.find(id, player);
    if (!canVoteSuggestion(suggestion)) throw new SuggestionError('votes_frozen', 'Cette suggestion est livrée : les votes sont figés.');
    if (value !== null && value !== 1 && value !== -1) throw new SuggestionError('invalid', 'Vote pour (+1) ou contre (-1).');
    await this.suggestions.setVote(id, player.id, value);
    return this.get(player, id);
  }

  /** Admin : ajouter à la roadmap, en retirer, marquer livrée, ou revenir en arrière. */
  async setStatus(actor: Actor, id: string, status: SuggestionStatus): Promise<SuggestionView> {
    if (!isAdmin(actor)) throw new SuggestionError('forbidden', 'Seul l’admin gère la roadmap.');
    if (!SUGGESTION_STATUSES.includes(status)) throw new SuggestionError('invalid', 'Statut inconnu.');
    const suggestion = await this.find(id, actor);
    if (suggestion.status !== status) await this.suggestions.update(id, { status });
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const suggestion = await this.find(id, actor);
    if (!canEditSuggestion(actor, suggestion)) {
      throw new SuggestionError('forbidden', 'Une suggestion dans la roadmap ou livrée ne se supprime que par l’admin.');
    }
    await this.suggestions.delete(id);
  }

  private async find(id: string, viewer: Actor): Promise<SuggestionDetail> {
    const suggestion = await this.suggestions.find(id, viewer.id);
    if (!suggestion) throw new SuggestionError('not_found', 'Suggestion introuvable.');
    return suggestion;
  }
}

function requireTitle(value: string): string {
  const title = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!title) throw new SuggestionError('invalid', 'Le titre est obligatoire.');
  if (title.length > SUGGESTION_TITLE_MAX) throw new SuggestionError('invalid', `Le titre fait ${SUGGESTION_TITLE_MAX} caractères au plus.`);
  return title;
}

function cleanDescription(value: string): string {
  const description = (value ?? '').trim();
  if (description.length > SUGGESTION_DESCRIPTION_MAX) {
    throw new SuggestionError('invalid', `La description fait ${SUGGESTION_DESCRIPTION_MAX} caractères au plus.`);
  }
  return description;
}

function requireCategory(value: SuggestionCategory): SuggestionCategory {
  if (!SUGGESTION_CATEGORIES.includes(value)) throw new SuggestionError('invalid', 'Choisis une catégorie : format, site, bot ou organisation.');
  return value;
}
