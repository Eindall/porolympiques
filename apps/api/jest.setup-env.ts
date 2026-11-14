/**
 * Exécuté par Jest AVANT chaque fichier de test, donc avant l'import de AppModule.
 *
 * Indispensable : `ConfigModule.forRoot()` lit les variables d'environnement au moment où AppModule est importé.
 * Les définir plus tard (dans un `beforeAll`) serait trop tard : l'application se connecterait à la base du `.env`,
 * c'est-à-dire la base de dev.
 */
const url = process.env['TEST_DATABASE_URL'];

if (url) {
  const database = new URL(url).pathname.slice(1);
  if (!/test/i.test(database)) {
    throw new Error(
      `TEST_DATABASE_URL pointe vers « ${database} » : le nom d'une base de test doit contenir « test » ` +
        `(les tests d'intégration vident les tables). Ex. postgres://…/porolympiques_test`,
    );
  }
  Object.assign(process.env, {
    DATABASE_URL: url,
    // Images envoyées pendant les tests : un dossier temporaire, jamais celui de dev.
    UPLOADS_DIR: require('node:path').join(require('node:os').tmpdir(), `porolympiques-test-uploads-${process.pid}`),
    JWT_SECRET: 'test-secret-test-secret-test-secret-test',
    APP_URL: 'http://localhost:4200',
    DISCORD_CLIENT_ID: 'test-client-id',
    DISCORD_CLIENT_SECRET: 'test-client-secret',
    DISCORD_REDIRECT_URI: 'http://localhost:4200/api/auth/discord/callback',
    DISCORD_BOT_TOKEN: 'test-bot-token',
    DISCORD_GUILD_ID: '300000000000000000',
    DISCORD_ADMIN_IDS: '100000000000000009',
    TWITCH_CLIENT_ID: 'test-twitch-id',
    TWITCH_CLIENT_SECRET: 'test-twitch-secret',
  });
}
