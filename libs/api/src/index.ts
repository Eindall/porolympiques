export * from './lib/api.module';
// Exportée pour que les tests d'intégration de l'app puissent simuler l'échange OAuth avec Discord.
export { DiscordStrategy } from './lib/auth/discord.strategy';
