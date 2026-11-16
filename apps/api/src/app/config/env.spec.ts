import { parseAdminIds, validateEnv } from './env';

const valid = {
  DATABASE_URL: 'postgres://porolympiques:devpass@127.0.0.1:5433/porolympiques',
  JWT_SECRET: 'x'.repeat(32),
  APP_URL: 'http://localhost:4200',
  DISCORD_CLIENT_ID: 'client-id',
  DISCORD_CLIENT_SECRET: 'client-secret',
  DISCORD_REDIRECT_URI: 'http://localhost:4200/api/auth/discord/callback',
  DISCORD_BOT_TOKEN: 'bot-token',
  DISCORD_GUILD_ID: '300000000000000000',
  DISCORD_ADMIN_IDS: '100000000000000009',
  TWITCH_CLIENT_ID: 'twitch-id',
  TWITCH_CLIENT_SECRET: 'twitch-secret',
};

describe('validateEnv', () => {
  it('accepte une configuration complète', () => {
    expect(validateEnv(valid)).toBe(valid);
  });

  it('liste toutes les variables manquantes', () => {
    expect(() => validateEnv({ APP_URL: valid.APP_URL })).toThrow(
      "Variables d'environnement manquantes : DATABASE_URL, JWT_SECRET, DISCORD_CLIENT_ID",
    );
  });

  it('refuse un secret de session trop court', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'court' })).toThrow('JWT_SECRET');
  });

  it.each(['https://porolympiques.tongcho7.com/', 'porolympiques.tongcho7.com', 'ftp://exemple.com'])(
    'refuse APP_URL = %s',
    (appUrl) => {
      expect(() => validateEnv({ ...valid, APP_URL: appUrl })).toThrow('APP_URL');
    },
  );

  it('accepte une APP_URL en https', () => {
    expect(() => validateEnv({ ...valid, APP_URL: 'https://porolympiques.tongcho7.com' })).not.toThrow();
  });

  it('refuse un identifiant de serveur qui n’en est pas un', () => {
    expect(() => validateEnv({ ...valid, DISCORD_GUILD_ID: 'mon-serveur' })).toThrow('DISCORD_GUILD_ID');
  });

  it('refuse une liste d’admins invalide', () => {
    expect(() => validateEnv({ ...valid, DISCORD_ADMIN_IDS: '100000000000000009,tong' })).toThrow('invalides : tong');
  });
});

describe('parseAdminIds', () => {
  it('découpe la liste et ignore les espaces', () => {
    expect(parseAdminIds(' 100000000000000009 , 100000000000000008 ,')).toEqual(
      new Set(['100000000000000009', '100000000000000008']),
    );
  });

  it('exige au moins un admin', () => {
    expect(() => parseAdminIds(' , ')).toThrow('DISCORD_ADMIN_IDS');
  });
});
