import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  RoadmapDto,
  SuggestionCategoryDto,
  SuggestionDto,
  SuggestionRequest,
  SuggestionStatusDto,
  SuggestionVoteDto,
} from '@porolympiques/shared';
import { firstValueFrom } from 'rxjs';

export interface SuggestionFilters {
  category?: SuggestionCategoryDto;
  status?: SuggestionStatusDto;
}

/** Appels des suggestions d'amélioration. */
@Injectable({ providedIn: 'root' })
export class SuggestionsApi {
  private readonly http = inject(HttpClient);

  list(filters: SuggestionFilters = {}): Promise<SuggestionDto[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value) params = params.set(key, value);
    return firstValueFrom(this.http.get<SuggestionDto[]>('/api/suggestions', { params }));
  }

  roadmap(): Promise<RoadmapDto> {
    return firstValueFrom(this.http.get<RoadmapDto>('/api/suggestions/roadmap'));
  }

  propose(request: SuggestionRequest): Promise<SuggestionDto> {
    return firstValueFrom(this.http.post<SuggestionDto>('/api/suggestions', request));
  }

  update(id: string, request: Partial<SuggestionRequest>): Promise<SuggestionDto> {
    return firstValueFrom(this.http.patch<SuggestionDto>(`/api/suggestions/${id}`, request));
  }

  /** Pose ou change le vote ; `null` le retire. */
  vote(id: string, value: SuggestionVoteDto | null): Promise<SuggestionDto> {
    const url = `/api/suggestions/${id}/vote`;
    return firstValueFrom(value === null ? this.http.delete<SuggestionDto>(url) : this.http.put<SuggestionDto>(url, { value }));
  }

  setStatus(id: string, status: SuggestionStatusDto): Promise<SuggestionDto> {
    return firstValueFrom(this.http.put<SuggestionDto>(`/api/suggestions/${id}/status`, { status }));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/suggestions/${id}`));
  }
}
