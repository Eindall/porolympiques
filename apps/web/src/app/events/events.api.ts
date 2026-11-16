import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  CreateEventRequest,
  EventDto,
  EventFormatRequest,
  EventSummaryDto,
  HallOfFameDto,
  HomeDto,
  NextGameDto,
  PlayerDto,
  PlayerRecordDto,
  ResultsRequest,
  SeasonDto,
  SeasonRequest,
  SeasonStandingsDto,
  UpdateEventRequest,
} from '@porolympiques/shared';
import { firstValueFrom } from 'rxjs';

/** Appels des saisons, des events, du choix du jeu et de la page admin. */
@Injectable({ providedIn: 'root' })
export class EventsApi {
  private readonly http = inject(HttpClient);

  seasons(): Promise<SeasonDto[]> {
    return this.get('/api/seasons');
  }
  seasonEvents(seasonId: string): Promise<EventSummaryDto[]> {
    return this.get(`/api/seasons/${seasonId}/events`);
  }
  event(id: string): Promise<EventDto> {
    return this.get(`/api/events/${id}`);
  }
  register(id: string): Promise<EventDto> {
    return firstValueFrom(this.http.post<EventDto>(`/api/events/${id}/registrations`, null));
  }
  home(): Promise<HomeDto> {
    return this.get('/api/home');
  }
  /** Classement d'une saison, ou de la saison en cours (`current`). */
  standings(seasonId: string): Promise<SeasonStandingsDto> {
    return this.get(`/api/seasons/${seasonId}/standings`);
  }
  player(id: string): Promise<PlayerRecordDto> {
    return this.get(`/api/players/${id}`);
  }
  hallOfFame(): Promise<HallOfFameDto> {
    return this.get('/api/hall-of-fame');
  }
  players(): Promise<PlayerDto[]> {
    return this.get('/api/players');
  }
  nextGame(): Promise<NextGameDto> {
    return this.get('/api/game-choice');
  }
  chooseGame(formatId: string): Promise<NextGameDto> {
    return firstValueFrom(this.http.put<NextGameDto>('/api/game-choice', { formatId }));
  }

  createSeason(request: SeasonRequest): Promise<SeasonDto> {
    return firstValueFrom(this.http.post<SeasonDto>('/api/admin/seasons', request));
  }
  updateSeason(id: string, request: Partial<SeasonRequest>): Promise<SeasonDto> {
    return firstValueFrom(this.http.patch<SeasonDto>(`/api/admin/seasons/${id}`, request));
  }
  seasonAction(id: string, action: 'start' | 'finish'): Promise<SeasonDto> {
    return firstValueFrom(this.http.post<SeasonDto>(`/api/admin/seasons/${id}/${action}`, null));
  }

  createEvent(request: CreateEventRequest): Promise<EventDto> {
    return firstValueFrom(this.http.post<EventDto>('/api/admin/events', request));
  }
  updateEvent(id: string, request: UpdateEventRequest): Promise<EventDto> {
    return firstValueFrom(this.http.patch<EventDto>(`/api/admin/events/${id}`, request));
  }
  changeFormat(id: string, format: EventFormatRequest): Promise<EventDto> {
    return firstValueFrom(this.http.put<EventDto>(`/api/admin/events/${id}/format`, { format }));
  }
  eventAction(id: string, action: 'start' | 'cancel'): Promise<EventDto> {
    return firstValueFrom(this.http.post<EventDto>(`/api/admin/events/${id}/${action}`, null));
  }
  addRegistration(id: string, playerId: string): Promise<EventDto> {
    return firstValueFrom(this.http.put<EventDto>(`/api/admin/events/${id}/registrations/${playerId}`, null));
  }
  removeRegistration(id: string, playerId: string): Promise<EventDto> {
    return firstValueFrom(this.http.delete<EventDto>(`/api/admin/events/${id}/registrations/${playerId}`));
  }
  assignTeam(id: string, playerId: string, teamId: string | null): Promise<EventDto> {
    return firstValueFrom(this.http.put<EventDto>(`/api/admin/events/${id}/registrations/${playerId}/team`, { teamId }));
  }
  createTeam(id: string, name: string): Promise<EventDto> {
    return firstValueFrom(this.http.post<EventDto>(`/api/admin/events/${id}/teams`, { name }));
  }
  deleteTeam(id: string, teamId: string): Promise<EventDto> {
    return firstValueFrom(this.http.delete<EventDto>(`/api/admin/events/${id}/teams/${teamId}`));
  }
  saveResults(id: string, request: ResultsRequest): Promise<EventDto> {
    return firstValueFrom(this.http.put<EventDto>(`/api/admin/events/${id}/results`, request));
  }
  validate(id: string, validated: boolean): Promise<EventDto> {
    return firstValueFrom(this.http.put<EventDto>(`/api/admin/events/${id}/validated`, { validated }));
  }

  private get<T>(url: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(url));
  }
}
