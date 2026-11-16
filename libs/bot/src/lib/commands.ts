import {
  PLAY_MODE_LABELS,
  PLAY_MODES,
  PRICE_TIER_LABELS,
  PRICE_TIERS,
  TEAM_MODE_LABELS,
  TEAM_MODES,
} from '@porolympiques/shared';
import { type RESTPostAPIChatInputApplicationCommandsJSONBody, SlashCommandBuilder } from 'discord.js';

/** Valeurs d'autocomplete du jeu de `/add-game` : un jeu enregistré, un jeu du catalogue, ou une saisie libre. */
export const GAME_VALUE = { existing: 'g:', catalog: 'x:', custom: 'c:' } as const;

const choices = <T extends string>(values: readonly T[], labels: Record<T, string>) => values.map((value) => ({ name: labels[value], value }));

/** Les commandes du bot, enregistrées sur le serveur au démarrage. */
export function commandDefinitions(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return [
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Classement de la saison en cours, ou d’une saison passée')
      .addStringOption((option) => option.setName('saison').setDescription('Une saison passée').setAutocomplete(true)),
    new SlashCommandBuilder()
      .setName('event')
      .setDescription('Les events en cours, ou le détail de l’un d’eux')
      .addStringOption((option) => option.setName('event').setDescription('L’event à afficher').setAutocomplete(true)),
    new SlashCommandBuilder()
      .setName('join')
      .setDescription('S’inscrire à un event')
      .addStringOption((option) => option.setName('event').setDescription('L’event (inutile s’il n’y en a qu’un d’ouvert)').setAutocomplete(true)),
    new SlashCommandBuilder().setName('list-games').setDescription('Le top de la boîte à idées, avec un bouton d’upvote par format'),
    new SlashCommandBuilder()
      .setName('add-game')
      .setDescription('Proposer un jeu et un format dans la boîte à idées')
      .addStringOption((option) => option.setName('jeu').setDescription('Le jeu, cherché dans le catalogue ou saisi librement').setRequired(true).setAutocomplete(true).setMaxLength(200))
      .addStringOption((option) => option.setName('format').setDescription('Le format : speedrun, tournoi, meilleur score…').setRequired(true).setMaxLength(100))
      .addStringOption((option) => option.setName('equipe').setDescription('Solo ou en équipe').setRequired(true).addChoices(...choices(TEAM_MODES, TEAM_MODE_LABELS)))
      .addStringOption((option) => option.setName('mode').setDescription('Asynchrone ou en live').setRequired(true).addChoices(...choices(PLAY_MODES, PLAY_MODE_LABELS)))
      .addStringOption((option) => option.setName('prix').setDescription('Tranche de prix (seulement pour un jeu pas encore proposé)').addChoices(...choices(PRICE_TIERS, PRICE_TIER_LABELS)))
      .addStringOption((option) => option.setName('description').setDescription('Règles ou précisions').setMaxLength(1000)),
    new SlashCommandBuilder()
      .setName('profile')
      .setDescription('Résultats et médailles d’un joueur')
      .addUserOption((option) => option.setName('joueur').setDescription('Le joueur (toi par défaut)')),
  ].map((command) => command.toJSON());
}
