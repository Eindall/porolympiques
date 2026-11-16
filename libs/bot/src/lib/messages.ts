import type {
  EventAnnouncement,
  EventSummary,
  EventView,
  IdeaView,
  PlayerRecord,
  ResultsAnnouncement,
  SeasonStandings,
  StandingsEntry,
} from '@porolympiques/domain';
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, PLAY_MODE_LABELS, TEAM_MODE_LABELS } from '@porolympiques/shared';
import {
  ActionRowBuilder,
  type APIEmbed,
  type APIEmbedField,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from 'discord.js';

/** Contenu d'un message du bot : texte, embeds et boutons, prêt pour `send`, `edit` ou `reply`. */
export interface BotMessage {
  content?: string;
  embeds: APIEmbed[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

/** Préfixes des identifiants de boutons. */
export const JOIN_BUTTON = 'join';
export const VOTE_BUTTON = 'vote';

/** Couleurs des embeds : indigo pour un main, teal pour un side (comme sur le site). */
const COLORS = { main: 0x4f46e5, side: 0x14b8a6, results: 0xf59e0b, neutral: 0x334155 } as const;
const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const EMBED_DESCRIPTION_MAX = 4096;
const FIELD_MAX = 1024;
const BUTTON_LABEL_MAX = 80;
/** Formats affichés par `/list-games` : un bouton d'upvote chacun, 5 par ligne. */
export const LIST_GAMES_TOP = 10;

/** Date affichée par Discord dans le fuseau du lecteur (Paris pour la bande) : `<t:…:f>`, et relative en option. */
export function when(date: Date, relative = false): string {
  const seconds = Math.floor(date.getTime() / 1000);
  return relative ? `<t:${seconds}:f> (<t:${seconds}:R>)` : `<t:${seconds}:f>`;
}

export const eventTitle = (event: Pick<EventSummary, 'game' | 'format'>) => `${event.game.name} — ${event.format.name}`;
export const eventUrl = (appUrl: string, eventId: string) => `${appUrl}/events/${eventId}`;
export const playerUrl = (appUrl: string, playerId: string) => `${appUrl}/joueurs/${playerId}`;
export const placeLabel = (place: number) => (place === 1 ? '1er' : `${place}e`);

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Jaquette du catalogue uniquement : les images envoyées sont servies derrière la connexion au site. */
function thumbnail(event: Pick<EventSummary, 'game'>): APIEmbed['thumbnail'] {
  return event.game.coverUrl && !event.game.coverFile ? { url: event.game.coverUrl } : undefined;
}

function linkRow(url: string, label: string, ...buttons: ButtonBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    ...buttons,
    new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(label),
  );
}

function eventFields(event: EventSummary, registrationOpen: boolean): APIEmbedField[] {
  const fields: APIEmbedField[] = [
    { name: 'Format', value: `${TEAM_MODE_LABELS[event.format.teamMode]} · ${PLAY_MODE_LABELS[event.format.playMode]}`, inline: true },
    { name: 'Statut', value: EVENT_STATUS_LABELS[event.status], inline: true },
    { name: 'Inscrits', value: String(event.registrationCount), inline: true },
    {
      name: 'Inscriptions',
      value: registrationOpen ? `Jusqu’au ${when(event.registrationEnd, true)}` : 'Closes',
      inline: false,
    },
  ];
  if (event.liveDate) fields.push({ name: 'Live', value: when(event.liveDate), inline: true });
  fields.push({ name: 'Fin', value: when(event.endDate), inline: true });
  if (event.host) fields.push({ name: 'Hôte', value: event.host.pseudo, inline: true });
  if (event.challongeUrl) fields.push({ name: 'Challonge', value: event.challongeUrl, inline: false });
  return fields;
}

function eventEmbed(event: EventSummary, registrationOpen: boolean, appUrl: string): APIEmbed {
  const description = [event.format.description, event.rules].filter(Boolean).join('\n\n');
  return {
    title: truncate(`${EVENT_TYPE_LABELS[event.type]} · ${eventTitle(event)}`, 256),
    url: eventUrl(appUrl, event.id),
    color: COLORS[event.type],
    ...(description && { description: truncate(description, EMBED_DESCRIPTION_MAX) }),
    fields: eventFields(event, registrationOpen),
    ...(thumbnail(event) && { thumbnail: thumbnail(event) }),
  };
}

function joinButton(eventId: string, open: boolean): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`${JOIN_BUTTON}:${eventId}`)
    .setStyle(ButtonStyle.Primary)
    .setLabel(open ? 'S’inscrire' : 'Inscriptions closes')
    .setDisabled(!open);
}

/** Annonce d'un event : @everyone à la publication seulement (une modification ne notifie pas). */
export function announcementMessage({ event, registrationOpen }: EventAnnouncement, appUrl: string, mention: boolean): BotMessage {
  return {
    ...(mention && { content: `@everyone Nouveau ${event.type === 'main' ? 'main event' : 'side event'} !` }),
    embeds: [eventEmbed(event, registrationOpen, appUrl)],
    components: [linkRow(eventUrl(appUrl, event.id), 'Voir sur le site', joinButton(event.id, registrationOpen))],
  };
}

function standingsLines(entries: StandingsEntry[]): string {
  return entries.map((entry) => `**${entry.rank}.** ${entry.player.pseudo} — ${entry.score} pts`).join('\n');
}

/** Message de clôture : les places de l'event, puis le haut du classement de la saison. */
export function resultsMessage(results: ResultsAnnouncement, appUrl: string): BotMessage {
  const { event, lines, unranked, season, standings } = results;
  const ranking = lines.map((line) => {
    const members = line.members.length > 0 ? ` (${line.members.join(', ')})` : '';
    return `${MEDALS[line.place] ?? `**${placeLabel(line.place)}**`} ${line.label}${members}`;
  });
  if (unranked > 0) ranking.push(`_${unranked} non classé${unranked > 1 ? 's' : ''}_`);
  const fields: APIEmbedField[] = [];
  if (season && standings.length > 0) {
    fields.push({ name: `Classement · ${season.name}`, value: truncate(standingsLines(standings), FIELD_MAX) });
  }
  return {
    embeds: [
      {
        title: truncate(`Résultats · ${eventTitle(event)}`, 256),
        url: eventUrl(appUrl, event.id),
        color: COLORS.results,
        description: truncate(ranking.join('\n') || 'Aucun classé.', EMBED_DESCRIPTION_MAX),
        fields,
        ...(thumbnail(event) && { thumbnail: thumbnail(event) }),
      },
    ],
    components: [
      linkRow(`${appUrl}/classement`, 'Classement complet', new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(eventUrl(appUrl, event.id)).setLabel('Voir l’event')),
    ],
  };
}

/** `/leaderboard` */
export function leaderboardMessage(standings: SeasonStandings, appUrl: string): BotMessage {
  const lines = standingsLines(standings.entries);
  return {
    embeds: [
      {
        title: `Classement · ${standings.season.name}`,
        url: `${appUrl}/classement`,
        color: COLORS.neutral,
        description: truncate(lines || 'Pas encore de résultat cette saison.', EMBED_DESCRIPTION_MAX),
      },
    ],
    components: [linkRow(`${appUrl}/classement`, 'Voir le détail')],
  };
}

/** `/event` sans argument : les events en cours ou à venir. */
export function eventListMessage(events: EventSummary[], appUrl: string): BotMessage {
  const lines = events.map(
    (event) => `**[${eventTitle(event)}](${eventUrl(appUrl, event.id)})** · ${EVENT_TYPE_LABELS[event.type]} · fin ${when(event.endDate)} · ${event.registrationCount} inscrit${event.registrationCount > 1 ? 's' : ''}`,
  );
  return {
    embeds: [
      {
        title: 'Events en cours',
        url: `${appUrl}/events`,
        color: COLORS.neutral,
        description: truncate(lines.join('\n') || 'Aucun event en cours.', EMBED_DESCRIPTION_MAX),
      },
    ],
    components: [linkRow(`${appUrl}/events`, 'Tous les events')],
  };
}

/** `/event <event>` : le détail, avec ses inscrits et le bouton d'inscription. */
export function eventDetailMessage(event: EventView, appUrl: string): BotMessage {
  const embed = eventEmbed(event, event.registrationOpen, appUrl);
  const names = event.registrations.map((registration) => registration.pseudo).join(', ');
  if (names) embed.fields = [...(embed.fields ?? []), { name: 'Liste des inscrits', value: truncate(names, FIELD_MAX) }];
  return { embeds: [embed], components: [linkRow(eventUrl(appUrl, event.id), 'Voir sur le site', joinButton(event.id, event.registrationOpen))] };
}

/** `/list-games` : le top de la boîte à idées, avec un bouton d'upvote par format (le même pour tous). */
export function ideasMessage(ideas: IdeaView[], appUrl: string): BotMessage {
  const top = ideas.slice(0, LIST_GAMES_TOP);
  const lines = top.map((idea, index) => {
    const played = idea.playedCount > 0 ? ` · joué ${idea.playedCount} fois` : '';
    const selected = idea.status === 'selected' ? ' · **retenu**' : '';
    return `**${index + 1}.** ${idea.game.name} — ${idea.name} · ▲ ${idea.votes}${played}${selected}`;
  });
  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  for (let start = 0; start < top.length; start += 5) {
    components.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        ...top.slice(start, start + 5).map((idea, offset) =>
          new ButtonBuilder()
            .setCustomId(`${VOTE_BUTTON}:${idea.id}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel(truncate(`▲ ${start + offset + 1}. ${idea.name}`, BUTTON_LABEL_MAX))
            .setDisabled(idea.status === 'selected'),
        ),
      ),
    );
  }
  components.push(linkRow(`${appUrl}/idees`, 'Boîte à idées'));
  return {
    embeds: [
      {
        title: 'Boîte à idées',
        url: `${appUrl}/idees`,
        color: COLORS.neutral,
        description: truncate(lines.join('\n') || 'Aucune idée pour l’instant. Propose la première avec `/add-game` !', EMBED_DESCRIPTION_MAX),
        footer: { text: 'Un bouton ajoute ton vote, ou le retire si tu as déjà voté.' },
      },
    ],
    components,
  };
}

/** `/profile` */
export function profileMessage(record: PlayerRecord, appUrl: string): BotMessage {
  const trophies = record.trophies.map((season) => `🏆 Champion · ${season.name}`);
  const medals = record.medals.map((medal) => `${MEDALS[medal.place]} ${medal.label}${medal.type === 'side' ? ' (side)' : ''}`);
  const seasons = record.seasons.map((season) => `**${season.season.name}** : ${placeLabel(season.rank)}, ${season.score} pts`);
  const fields: APIEmbedField[] = [];
  if (trophies.length > 0) fields.push({ name: 'Trophées', value: truncate(trophies.join('\n'), FIELD_MAX) });
  fields.push({ name: 'Médailles', value: truncate(medals.join('\n') || 'Pas encore de podium.', FIELD_MAX) });
  fields.push({ name: 'Saisons', value: truncate(seasons.join('\n') || 'Pas encore de résultat.', FIELD_MAX) });
  return {
    embeds: [
      {
        title: record.player.pseudo,
        url: playerUrl(appUrl, record.player.id),
        color: COLORS.neutral,
        ...(record.player.avatarUrl && { thumbnail: { url: record.player.avatarUrl } }),
        fields,
      },
    ],
    components: [linkRow(playerUrl(appUrl, record.player.id), 'Page du joueur')],
  };
}
