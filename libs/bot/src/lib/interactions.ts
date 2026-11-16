import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CatalogService,
  EventError,
  EventsService,
  type GameChoice,
  HonoursService,
  IdeaError,
  IdeasService,
  type Player,
  PlayersService,
  SeasonsService,
  registrationOpen,
  StandingsService,
} from '@porolympiques/domain';
import type { PlayModeDto, PriceTierDto, TeamModeDto } from '@porolympiques/shared';
import {
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  Events,
  type Interaction,
  MessageFlags,
} from 'discord.js';
import { BotConfig } from './bot-config';
import { GAME_VALUE } from './commands';
import { DISCORD_CLIENT } from './discord-client';
import {
  JOIN_BUTTON,
  VOTE_BUTTON,
  eventDetailMessage,
  eventListMessage,
  eventTitle,
  ideasMessage,
  leaderboardMessage,
  profileMessage,
} from './messages';

/** Nombre maximal de choix d'une réponse d'autocomplete (limite de Discord). */
export const AUTOCOMPLETE_MAX = 25;
const CHOICE_NAME_MAX = 100;

/** Refus à afficher tel quel au joueur (message du domaine). */
class Refusal extends Error {}

const clip = (text: string, max = CHOICE_NAME_MAX) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** Jeu choisi dans `/add-game` : une valeur d'autocomplete, ou un texte tapé sans choisir (saisie libre). */
export function parseGameChoice(value: string): GameChoice {
  if (value.startsWith(GAME_VALUE.existing)) return { kind: 'existing', gameId: value.slice(GAME_VALUE.existing.length) };
  if (value.startsWith(GAME_VALUE.catalog)) return { kind: 'catalog', externalId: value.slice(GAME_VALUE.catalog.length) };
  if (value.startsWith(GAME_VALUE.custom)) return { kind: 'custom', name: value.slice(GAME_VALUE.custom.length) };
  return { kind: 'custom', name: value };
}

/**
 * Commandes, autocomplete et boutons du bot. Le joueur est reconnu par son identifiant Discord ; les règles
 * (inscriptions closes, votes gelés…) sont celles du domaine, et ses refus sont affichés tels quels.
 */
@Injectable()
export class BotInteractions {
  private readonly logger = new Logger('Bot');

  constructor(
    @Inject(DISCORD_CLIENT) private readonly client: Client,
    private readonly config: BotConfig,
    private readonly players: PlayersService,
    private readonly events: EventsService,
    private readonly seasons: SeasonsService,
    private readonly standings: StandingsService,
    private readonly ideas: IdeasService,
    private readonly catalog: CatalogService,
    private readonly honours: HonoursService,
  ) {}

  listen(): void {
    this.client.on(Events.InteractionCreate, (interaction) => void this.handle(interaction));
  }

  async handle(interaction: Interaction): Promise<void> {
    if (interaction.guildId !== this.config.guildId) return;
    try {
      if (interaction.isAutocomplete()) await this.autocomplete(interaction);
      else if (interaction.isChatInputCommand()) await this.command(interaction);
      else if (interaction.isButton()) await this.button(interaction);
    } catch (error) {
      await this.fail(interaction, error);
    }
  }

  private async command(interaction: ChatInputCommandInteraction): Promise<void> {
    const appUrl = this.config.appUrl;
    switch (interaction.commandName) {
      case 'leaderboard': {
        const seasonId = interaction.options.getString('saison');
        const standings = seasonId ? await this.standings.forSeason(seasonId) : await this.standings.forActiveSeason();
        if (!standings) throw new Refusal(seasonId ? 'Saison introuvable.' : 'Pas de saison en cours.');
        await interaction.reply(leaderboardMessage(standings, appUrl));
        return;
      }
      case 'event': {
        const eventId = interaction.options.getString('event');
        if (!eventId) {
          await interaction.reply(eventListMessage(await this.events.listAnnounced(), appUrl));
          return;
        }
        const player = await this.player(interaction.user.id);
        await interaction.reply(eventDetailMessage(await this.events.detail(player, eventId), appUrl));
        return;
      }
      case 'join': {
        const player = await this.player(interaction.user.id);
        const eventId = interaction.options.getString('event') ?? (await this.onlyOpenEvent());
        const event = await this.events.register(player, eventId);
        await interaction.reply({ content: `C’est noté, tu es inscrit à **${eventTitle(event)}** !`, flags: MessageFlags.Ephemeral });
        return;
      }
      case 'list-games': {
        const player = await this.player(interaction.user.id);
        await interaction.reply(ideasMessage(await this.ideas.list(player), appUrl));
        return;
      }
      case 'add-game': {
        const player = await this.player(interaction.user.id);
        const idea = await this.ideas.suggest(player, {
          game: parseGameChoice(interaction.options.getString('jeu', true)),
          priceTier: (interaction.options.getString('prix') as PriceTierDto | null) ?? null,
          name: interaction.options.getString('format', true),
          description: interaction.options.getString('description') ?? '',
          teamMode: interaction.options.getString('equipe', true) as TeamModeDto,
          playMode: interaction.options.getString('mode', true) as PlayModeDto,
        });
        await interaction.reply({
          content: `Idée ajoutée : **${idea.game.name} — ${idea.name}**, avec ton vote. ${appUrl}/idees`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      case 'profile': {
        const user = interaction.options.getUser('joueur') ?? interaction.user;
        const target = await this.players.findByDiscordId(user.id);
        const record = target ? await this.honours.player(target.id) : null;
        if (!record) throw new Refusal(`${user.username} n’a pas de fiche de joueur.`);
        await interaction.reply(profileMessage(record, appUrl));
        return;
      }
    }
  }

  private async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);
    const query = focused.value.trim().toLowerCase();
    const matches = (name: string) => name.toLowerCase().includes(query);
    let choices: { name: string; value: string }[] = [];

    if (focused.name === 'saison') {
      choices = (await this.seasons.list()).filter((season) => matches(season.name)).map((season) => ({ name: clip(season.name), value: season.id }));
    } else if (focused.name === 'event') {
      choices = (await this.events.listAnnounced())
        .filter((event) => matches(eventTitle(event)))
        .map((event) => ({ name: clip(`${eventTitle(event)} (${event.type === 'main' ? 'main' : 'side'})`), value: event.id }));
    } else if (focused.name === 'jeu') {
      const typed = focused.value.trim();
      const { results } = await this.catalog.search(typed);
      choices = results.map((game) => ({
        name: clip(`${game.name}${game.year ? ` (${game.year})` : ''}${game.gameId ? ' · déjà proposé' : ''}`),
        value: game.gameId ? `${GAME_VALUE.existing}${game.gameId}` : `${GAME_VALUE.catalog}${game.externalId}`,
      }));
      if (typed.length >= 2) choices.push({ name: clip(`Saisir « ${typed} » librement`), value: clip(`${GAME_VALUE.custom}${typed}`, 100) });
    }
    await interaction.respond(choices.slice(0, AUTOCOMPLETE_MAX));
  }

  private async button(interaction: ButtonInteraction): Promise<void> {
    const [kind, id] = interaction.customId.split(':');
    const player = await this.player(interaction.user.id);
    if (kind === JOIN_BUTTON) {
      const event = await this.events.register(player, id);
      await interaction.reply({ content: `C’est noté, tu es inscrit à **${eventTitle(event)}** !`, flags: MessageFlags.Ephemeral });
    } else if (kind === VOTE_BUTTON) {
      const idea = (await this.ideas.list(player)).find((item) => item.id === id);
      if (!idea) throw new Refusal('Ce format n’est plus dans la boîte à idées.');
      const updated = idea.votedByMe ? await this.ideas.unvote(player, id) : await this.ideas.vote(player, id);
      // Le message public reprend les nouveaux compteurs ; la confirmation ne s'adresse qu'au votant.
      await interaction.update(ideasMessage(await this.ideas.list(player), this.config.appUrl));
      await interaction.followUp({
        content: updated.votedByMe ? `Vote ajouté pour **${updated.game.name} — ${updated.name}**.` : `Vote retiré pour **${updated.game.name} — ${updated.name}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async player(discordId: string): Promise<Player> {
    const player = await this.players.findByDiscordId(discordId);
    if (!player || !player.active) throw new Refusal('Je ne te trouve pas parmi les joueurs du serveur. Réessaie dans quelques minutes.');
    return player;
  }

  private async onlyOpenEvent(): Promise<string> {
    const now = new Date();
    const open = (await this.events.listAnnounced()).filter((event) => registrationOpen(event, now));
    if (open.length === 1) return open[0].id;
    throw new Refusal(open.length === 0 ? 'Aucun event n’est ouvert aux inscriptions.' : 'Plusieurs events sont ouverts : choisis-en un dans l’option `event`.');
  }

  private async fail(interaction: Interaction, error: unknown): Promise<void> {
    const known = error instanceof Refusal || error instanceof EventError || error instanceof IdeaError;
    if (!known) this.logger.error(`Interaction ${interaction.id} : ${error instanceof Error ? error.stack : String(error)}`);
    if (interaction.isAutocomplete()) {
      if (!interaction.responded) await interaction.respond([]).catch(() => undefined);
      return;
    }
    if (!interaction.isRepliable()) return;
    const content = known ? (error as Error).message : 'Quelque chose a coincé. Réessaie dans un instant.';
    const reply = { content, flags: MessageFlags.Ephemeral } as const;
    await (interaction.replied || interaction.deferred ? interaction.followUp(reply) : interaction.reply(reply)).catch(() => undefined);
  }
}
