import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  COVER_MAX_BYTES,
  COVER_TYPES,
  type GameDto,
  type GameSearchDto,
  type IdeaDto,
  type IdeaErrorDto,
  type PlayModeDto,
  type PriceTierDto,
  type SuggestIdeaRequest,
  type TeamModeDto,
  type UpdateIdeaRequest,
} from '@porolympiques/shared';
import { firstValueFrom } from 'rxjs';

export interface IdeaFilters {
  gameId?: string;
  priceTier?: PriceTierDto;
  teamMode?: TeamModeDto;
  playMode?: PlayModeDto;
}

/** Appels de la boîte à idées. */
@Injectable({ providedIn: 'root' })
export class IdeasApi {
  private readonly http = inject(HttpClient);

  searchGames(query: string): Promise<GameSearchDto> {
    return firstValueFrom(this.http.get<GameSearchDto>('/api/catalog/games', { params: { q: query } }));
  }

  list(filters: IdeaFilters = {}): Promise<IdeaDto[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value) params = params.set(key, value);
    return firstValueFrom(this.http.get<IdeaDto[]>('/api/ideas', { params }));
  }

  suggest(request: SuggestIdeaRequest): Promise<IdeaDto> {
    return firstValueFrom(this.http.post<IdeaDto>('/api/ideas', request));
  }

  vote(id: string, voted: boolean): Promise<IdeaDto> {
    const url = `/api/ideas/${id}/vote`;
    return firstValueFrom(voted ? this.http.put<IdeaDto>(url, null) : this.http.delete<IdeaDto>(url));
  }

  update(id: string, request: UpdateIdeaRequest): Promise<IdeaDto> {
    return firstValueFrom(this.http.patch<IdeaDto>(`/api/ideas/${id}`, request));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/ideas/${id}`));
  }

  uploadCover(gameId: string, file: File): Promise<GameDto> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(this.http.put<GameDto>(`/api/games/${gameId}/cover`, form));
  }

  removeCover(gameId: string): Promise<GameDto> {
    return firstValueFrom(this.http.delete<GameDto>(`/api/games/${gameId}/cover`));
  }
}

/** Vérification avant envoi (le serveur revérifie le contenu) : message d'erreur, ou `null` si l'image convient. */
export function coverFileError(file: File): string | null {
  if (!(COVER_TYPES as readonly string[]).includes(file.type)) return 'Image refusée : seuls les PNG, JPEG et WebP sont acceptés.';
  if (file.size > COVER_MAX_BYTES) return 'Image trop lourde : 2 Mo au maximum.';
  return null;
}

/** Message à afficher pour une erreur d'appel : celui du serveur s'il en donne un, sinon un message générique. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as Partial<IdeaErrorDto> | null;
    if (body && typeof body.message === 'string' && body.code) return body.message;
    if (error.status === 400) return 'Saisie invalide : vérifie le formulaire.';
    if (error.status === 413) return 'Image trop lourde : 2 Mo au maximum.';
  }
  return 'Quelque chose a coincé. Réessaie dans un instant.';
}
