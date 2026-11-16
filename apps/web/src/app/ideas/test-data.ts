import type { IdeaDto } from '@porolympiques/shared';

/** Une idée de test, à compléter. */
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
