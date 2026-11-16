import type { EventDto, NextGameDto } from '@porolympiques/shared';
import { idea } from '../ideas/test-data';

/** Données de test des pages events et admin. */
export function eventDto(overrides: Partial<EventDto> = {}): EventDto {
  return {
    id: 'e-1',
    seasonId: 's-1',
    type: 'main',
    status: 'registration',
    coefficient: 1,
    validated: false,
    rules: 'Meilleur chrono.',
    announceDate: '2026-02-01T11:00:00.000Z',
    registrationEnd: '2026-02-21T11:00:00.000Z',
    endDate: '2026-02-28T11:00:00.000Z',
    liveDate: null,
    finishedAt: null,
    challongeUrl: null,
    host: null,
    format: { id: 'f-1', name: 'Speedrun', description: '', teamMode: 'solo', playMode: 'async' },
    game: { id: 'g-1', name: 'Trackmania', coverUrl: null },
    registrationCount: 2,
    teams: [],
    registrations: [
      { playerId: 'p-1', pseudo: 'Alice', avatarUrl: '', teamId: null },
      { playerId: 'p-2', pseudo: 'Bruno', avatarUrl: '', teamId: null },
    ],
    results: [],
    registrationOpen: true,
    registeredByMe: false,
    sideWarnings: [],
    ...overrides,
  };
}

export function nextGameDto(overrides: Partial<NextGameDto> = {}): NextGameDto {
  return {
    status: 'open',
    nextMain: null,
    lastMain: { id: 'e-0', finishedAt: '2026-02-01T11:00:00.000Z' },
    choosers: [{ id: 'p-2', pseudo: 'Bruno' }],
    deadline: '2026-02-04T11:00:00.000Z',
    candidates: [idea({ id: 'f-1', name: 'Speedrun' }), idea({ id: 'f-2', name: 'Course libre', votes: 0 })],
    pick: null,
    canChoose: true,
    ...overrides,
  };
}
