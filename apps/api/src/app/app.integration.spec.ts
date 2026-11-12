import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

/**
 * Démarre l'application complète sur une vraie base (TEST_DATABASE_URL) et appelle la route de santé en HTTP.
 * Sans TEST_DATABASE_URL, la suite est ignorée. AppModule est importé dans `beforeAll` : `ConfigModule.forRoot()`
 * valide l'environnement dès l'import, ce qui ferait échouer le fichier même quand la suite est ignorée.
 */
const describeWithDb = process.env['TEST_DATABASE_URL'] ? describe : describe.skip;

describeWithDb('Application (intégration)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const { AppModule } = await import('./app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health répond ok sans session', async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('renvoie 404 sur une route inconnue', async () => {
    const response = await fetch(`${baseUrl}/api/inconnue`);

    expect(response.status).toBe(404);
  });
});
