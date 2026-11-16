import { EventError, IdeaError } from '@porolympiques/domain';
import { MessageFlags, type Interaction } from 'discord.js';
import type { BotConfig } from './bot-config';
import { BotInteractions } from './interactions';

const GUILD = '300000000000000000';
const alice = { id: 'p-1', discordId: '1', pseudo: 'Alice', avatarUrl: '', role: 'player' as const, active: true };
const openEvent = (id: string, overrides: object = {}) => ({
  id,
  type: 'main',
  status: 'registration',
  registrationEnd: new Date(Date.now() + 86_400_000),
  game: { name: 'Trackmania' },
  format: { name: `Format ${id}` },
  ...overrides,
});

/** Fausse interaction Discord : seulement ce que le bot lit et appelle. */
function interaction(kind: 'command' | 'autocomplete' | 'button', fields: Record<string, unknown> = {}) {
  const strings = (fields['strings'] ?? {}) as Record<string, string>;
  return {
    id: 'i-1',
    guildId: GUILD,
    user: { id: '1', username: 'alice' },
    replied: false,
    deferred: false,
    responded: false,
    isAutocomplete: () => kind === 'autocomplete',
    isChatInputCommand: () => kind === 'command',
    isButton: () => kind === 'button',
    isRepliable: () => kind !== 'autocomplete',
    options: {
      getString: (name: string, required?: boolean) => {
        if (required && !(name in strings)) throw new Error(`option ${name} manquante`);
        return strings[name] ?? null;
      },
      getUser: () => null,
      getFocused: () => fields['focused'],
    },
    reply: jest.fn(async () => undefined),
    respond: jest.fn(async () => undefined),
    update: jest.fn(async () => undefined),
    followUp: jest.fn(async () => undefined),
    ...fields,
  };
}

function setup() {
  const services = {
    players: { findByDiscordId: jest.fn(async (id: string) => (id === '1' ? alice : null)) },
    events: { listAnnounced: jest.fn(async () => [openEvent('e-1')]), register: jest.fn(async (_player: unknown, id: string) => openEvent(id)), detail: jest.fn() },
    seasons: { list: jest.fn(async () => []) },
    standings: { forActiveSeason: jest.fn(async () => null), forSeason: jest.fn() },
    ideas: { list: jest.fn(async () => []), vote: jest.fn(), unvote: jest.fn(), suggest: jest.fn() },
    catalog: { search: jest.fn(async () => ({ results: [], catalogAvailable: true })) },
    honours: { player: jest.fn() },
  };
  const config = { guildId: GUILD, appUrl: 'https://poro.example', announcementsChannelId: null, interactionsEnabled: true } as BotConfig;
  const bot = new BotInteractions(
    {} as never,
    config,
    services.players as never,
    services.events as never,
    services.seasons as never,
    services.standings as never,
    services.ideas as never,
    services.catalog as never,
    services.honours as never,
  );
  const handle = (fake: ReturnType<typeof interaction>) => bot.handle(fake as unknown as Interaction);
  return { services, handle };
}

describe('BotInteractions', () => {
  it('inscrit au seul event ouvert avec /join, en réponse privée', async () => {
    const { services, handle } = setup();
    const fake = interaction('command', { commandName: 'join' });

    await handle(fake);

    expect(services.events.register).toHaveBeenCalledWith(alice, 'e-1');
    expect(fake.reply).toHaveBeenCalledWith({ content: 'C’est noté, tu es inscrit à **Trackmania — Format e-1** !', flags: MessageFlags.Ephemeral });
  });

  it('demande de choisir quand plusieurs events sont ouverts, et affiche les refus du domaine', async () => {
    const { services, handle } = setup();
    services.events.listAnnounced.mockResolvedValue([openEvent('e-1'), openEvent('e-2')]);
    const several = interaction('command', { commandName: 'join' });
    await handle(several);
    expect(several.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Plusieurs events'), flags: MessageFlags.Ephemeral }));

    services.events.register.mockRejectedValue(new EventError('closed', 'Les inscriptions à cet event sont fermées.'));
    const button = interaction('button', { customId: 'join:e-2' });
    await handle(button);
    expect(button.reply).toHaveBeenCalledWith({ content: 'Les inscriptions à cet event sont fermées.', flags: MessageFlags.Ephemeral });
  });

  it('refuse un compte inconnu et ignore les autres serveurs', async () => {
    const { services, handle } = setup();
    const stranger = interaction('command', { commandName: 'join', user: { id: '2', username: 'bob' } });
    await handle(stranger);
    expect(stranger.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Je ne te trouve pas') }));

    const elsewhere = interaction('command', { commandName: 'join', guildId: '1' });
    await handle(elsewhere);
    expect(elsewhere.reply).not.toHaveBeenCalled();
    expect(services.events.register).not.toHaveBeenCalled();
  });

  it('propose les jeux du catalogue et la saisie libre en autocomplete de /add-game', async () => {
    const { services, handle } = setup();
    services.catalog.search.mockResolvedValue({
      catalogAvailable: true,
      results: [
        { gameId: 'g-1', externalId: '1', name: 'Trackmania', year: null },
        { gameId: null, externalId: '1942', name: 'The Witcher 3', year: 2015 },
      ],
    } as never);
    const fake = interaction('autocomplete', { focused: { name: 'jeu', value: 'tr' } });

    await handle(fake);

    expect(fake.respond).toHaveBeenCalledWith([
      { name: 'Trackmania · déjà proposé', value: 'g:g-1' },
      { name: 'The Witcher 3 (2015)', value: 'x:1942' },
      { name: 'Saisir « tr » librement', value: 'c:tr' },
    ]);
  });

  it('propose une idée avec /add-game, et relaie la tranche de prix demandée', async () => {
    const { services, handle } = setup();
    services.ideas.suggest.mockRejectedValueOnce(new IdeaError('price_tier_required', 'Choisis la tranche de prix de ce jeu.'));
    const strings = { jeu: 'x:1942', format: 'Speedrun', equipe: 'solo', mode: 'async' };
    const first = interaction('command', { commandName: 'add-game', strings });
    await handle(first);
    expect(first.reply).toHaveBeenCalledWith({ content: 'Choisis la tranche de prix de ce jeu.', flags: MessageFlags.Ephemeral });

    services.ideas.suggest.mockResolvedValueOnce({ name: 'Speedrun', game: { name: 'The Witcher 3' } } as never);
    const second = interaction('command', { commandName: 'add-game', strings: { ...strings, prix: '10to30' } });
    await handle(second);
    expect(services.ideas.suggest).toHaveBeenLastCalledWith(alice, {
      game: { kind: 'catalog', externalId: '1942' },
      priceTier: '10to30',
      name: 'Speedrun',
      description: '',
      teamMode: 'solo',
      playMode: 'async',
    });
    expect(second.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('The Witcher 3 — Speedrun') }));
  });

  it('ajoute ou retire le vote du joueur qui clique, et met à jour le message public', async () => {
    const { services, handle } = setup();
    const idea = { id: 'f-1', name: 'Speedrun', game: { name: 'Trackmania' }, votes: 1, status: 'proposed', playedCount: 0 };
    services.ideas.list.mockResolvedValue([{ ...idea, votedByMe: true }] as never);
    services.ideas.unvote.mockResolvedValue({ ...idea, votedByMe: false } as never);
    const fake = interaction('button', { customId: 'vote:f-1' });

    await handle(fake);

    expect(services.ideas.unvote).toHaveBeenCalledWith(alice, 'f-1');
    expect(services.ideas.vote).not.toHaveBeenCalled();
    expect(fake.update).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.objectContaining({ title: 'Boîte à idées' })] }));
    expect(fake.followUp).toHaveBeenCalledWith({ content: 'Vote retiré pour **Trackmania — Speedrun**.', flags: MessageFlags.Ephemeral });
  });

  it('cache une erreur inattendue derrière un message générique', async () => {
    const { services, handle } = setup();
    services.standings.forActiveSeason.mockRejectedValue(new Error('base injoignable'));
    const fake = interaction('command', { commandName: 'leaderboard' });

    await handle(fake);

    expect(fake.reply).toHaveBeenCalledWith({ content: 'Quelque chose a coincé. Réessaie dans un instant.', flags: MessageFlags.Ephemeral });
  });
});
