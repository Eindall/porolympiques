import { validateEnv } from './env';

const valid = {
  DATABASE_URL: 'postgres://porolympiques:devpass@127.0.0.1:5433/porolympiques',
  JWT_SECRET: 'x'.repeat(32),
  APP_URL: 'http://localhost:4200',
};

describe('validateEnv', () => {
  it('accepte une configuration complète', () => {
    expect(validateEnv(valid)).toBe(valid);
  });

  it('liste toutes les variables manquantes', () => {
    expect(() => validateEnv({ APP_URL: valid.APP_URL })).toThrow(
      "Variables d'environnement manquantes : DATABASE_URL, JWT_SECRET",
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
});
