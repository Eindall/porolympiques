import type { EventSummary, IdeaView, PlayerRecord, ResultsAnnouncement } from '@porolympiques/domain';
import { ButtonStyle, type APIButtonComponentWithCustomId, type APIButtonComponentWithURL } from 'discord.js';
import { announcementMessage, ideasMessage, profileMessage, resultsMessage, when } from './messages';

const APP = 'https://poro.example';
const season = { id: 's-1', name: 'Saison 1', startDate: new Date(), endDate: new Date(), scoringScale: {}, mainQuota: 3, sideQuota: 2, status: 'active' as const };

const event = (overrides: Partial<EventSummary> = {}): EventSummary => ({
  id: 'e-1',
  seasonId: 's-1',
  formatId: 'f-1',
  type: 'main',
  coefficient: 1,
  status: 'registration',
  rules: 'Meilleur chrono.',
  announceDate: new Date('2026-02-01T10:00:00Z'),
  registrationEnd: new Date('2026-02-10T20:00:00Z'),
  endDate: new Date('2026-02-20T20:00:00Z'),
  liveDate: null,
  hostId: null,
  challongeUrl: null,
  validated: false,
  finishedAt: null,
  announcementMessageId: null,
  resultsMessageId: null,
  createdAt: new Date(),
  format: { id: 'f-1', name: 'Speedrun', description: 'Le plus vite possible.', teamMode: 'solo', playMode: 'async', status: 'selected' },
  game: { id: 'g-1', name: 'Trackmania', coverUrl: 'https://images.igdb.com/t.jpg', coverFile: null },
  host: null,
  registrationCount: 3,
  ...overrides,
});

const buttons = (message: ReturnType<typeof announcementMessage>) => message.components.flatMap((row) => row.toJSON().components);

describe('messages du bot', () => {
  it('affiche une date dans le fuseau du lecteur, avec Discord', () => {
    expect(when(new Date('2026-02-10T20:00:00Z'))).toBe('<t:1770753600:f>');
    expect(when(new Date('2026-02-10T20:00:00Z'), true)).toBe('<t:1770753600:f> (<t:1770753600:R>)');
  });

  it('annonce un main avec @everyone, ses infos, le bouton d’inscription et le lien du site', () => {
    const message = announcementMessage({ event: event(), registrationOpen: true }, APP, true);

    expect(message.content).toContain('@everyone');
    const [embed] = message.embeds;
    expect(embed).toMatchObject({ title: 'Main event · Trackmania — Speedrun', url: `${APP}/events/e-1`, color: 0x4f46e5, thumbnail: { url: 'https://images.igdb.com/t.jpg' } });
    expect(embed.description).toBe('Le plus vite possible.\n\nMeilleur chrono.');
    expect(embed.fields?.find((field) => field.name === 'Inscrits')?.value).toBe('3');
    const [join, link] = buttons(message) as [APIButtonComponentWithCustomId, APIButtonComponentWithURL];
    expect(join).toMatchObject({ custom_id: 'join:e-1', label: 'S’inscrire', style: ButtonStyle.Primary, disabled: false });
    expect(link).toMatchObject({ url: `${APP}/events/e-1`, style: ButtonStyle.Link });
  });

  it('désactive l’inscription une fois closes, sans mention à la modification, et cache une image privée', () => {
    const message = announcementMessage(
      { event: event({ type: 'side', status: 'cancelled', game: { id: 'g-2', name: 'Jeu maison', coverUrl: null, coverFile: 'a.png' } }), registrationOpen: false },
      APP,
      false,
    );

    expect(message.content).toBeUndefined();
    expect(message.embeds[0]).toMatchObject({ title: 'Side event · Jeu maison — Speedrun', color: 0x14b8a6 });
    expect(message.embeds[0].thumbnail).toBeUndefined();
    expect(message.embeds[0].fields?.find((field) => field.name === 'Statut')?.value).toBe('Annulé');
    expect(buttons(message)[0]).toMatchObject({ label: 'Inscriptions closes', disabled: true });
  });

  it('donne les résultats avec médailles, équipes, non classés et le haut du classement', () => {
    const results: ResultsAnnouncement = {
      event: event({ status: 'finished' }),
      lines: [
        { place: 1, label: 'Les Rouges', members: ['Alice', 'Bruno'] },
        { place: 1, label: 'Les Bleus', members: ['Chloé'] },
        { place: 3, label: 'Les Verts', members: [] },
        { place: 4, label: 'Les Jaunes', members: [] },
      ],
      unranked: 2,
      season,
      standings: [
        { rank: 1, player: { id: 'p-1', pseudo: 'Alice', avatarUrl: '', active: true }, score: 48, wins: 2, results: [] },
        { rank: 2, player: { id: 'p-2', pseudo: 'Bruno', avatarUrl: '', active: true }, score: 30, wins: 0, results: [] },
      ],
    };

    const [embed] = resultsMessage(results, APP).embeds;
    expect(embed.title).toBe('Résultats · Trackmania — Speedrun');
    expect(embed.description?.split('\n')).toEqual([
      '🥇 Les Rouges (Alice, Bruno)',
      '🥇 Les Bleus (Chloé)',
      '🥉 Les Verts',
      '**4e** Les Jaunes',
      '_2 non classés_',
    ]);
    expect(embed.fields).toEqual([{ name: 'Classement · Saison 1', value: '**1.** Alice — 48 pts\n**2.** Bruno — 30 pts' }]);
  });

  it('met un bouton d’upvote par format du top, cinq par ligne, et gèle un format retenu', () => {
    const idea = (index: number, overrides: Partial<IdeaView> = {}) =>
      ({ id: `f-${index}`, name: `Format ${index}`, votes: 12 - index, status: 'proposed', playedCount: 0, game: { name: 'Jeu' }, ...overrides }) as IdeaView;
    const ideas = Array.from({ length: 12 }, (_, index) => idea(index + 1));
    ideas[1] = idea(2, { status: 'selected', playedCount: 2 });

    const message = ideasMessage(ideas, APP);
    const rows = message.components.map((row) => row.toJSON().components);

    expect(rows.map((row) => row.length)).toEqual([5, 5, 1]);
    expect(rows[0][0]).toMatchObject({ custom_id: 'vote:f-1', label: '▲ 1. Format 1' });
    expect(rows[0][1]).toMatchObject({ custom_id: 'vote:f-2', disabled: true });
    expect(message.embeds[0].description?.split('\n')[1]).toBe('**2.** Jeu — Format 2 · ▲ 10 · joué 2 fois · **retenu**');
  });

  it('résume un joueur : trophées, médailles et saisons', () => {
    const record: PlayerRecord = {
      player: { id: 'p-1', pseudo: 'Alice', avatarUrl: 'https://cdn/a.png', active: true },
      seasons: [{ season, rank: 1, score: 65, results: [] }],
      medals: [{ playerId: 'p-1', seasonId: 's-1', eventId: 'e-1', label: 'Wikipédia — Liens', type: 'side', place: 2, endDate: new Date() }],
      trophies: [season],
    };

    const [embed] = profileMessage(record, APP).embeds;
    expect(embed).toMatchObject({ title: 'Alice', url: `${APP}/joueurs/p-1`, thumbnail: { url: 'https://cdn/a.png' } });
    expect(embed.fields).toEqual([
      { name: 'Trophées', value: '🏆 Champion · Saison 1' },
      { name: 'Médailles', value: '🥈 Wikipédia — Liens (side)' },
      { name: 'Saisons', value: '**Saison 1** : 1er, 65 pts' },
    ]);
  });
});
