import { Client, GatewayIntentBits, Partials } from 'discord.js';

export const DISCORD_CLIENT = Symbol('DiscordClient');

/**
 * Client discord.js du bot. L'intent privilégié « Server Members » (GuildMembers) doit être activé dans le portail
 * développeur : il sert à lister les membres et à recevoir les arrivées, départs et changements de surnom.
 */
export function createDiscordClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    // Un départ peut concerner un membre absent du cache : on reçoit quand même l'événement, avec son identifiant.
    partials: [Partials.GuildMember, Partials.User],
  });
}
