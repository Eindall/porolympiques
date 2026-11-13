/**
 * `npm run db:seed` : charge la saison fictive dans la base du `.env` (développement uniquement).
 * Relançable : la saison fictive précédente est remplacée.
 */
import { seedFictionalSeason } from '@porolympiques/database';
import dataSource from './data-source';

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Refus : la saison fictive ne se charge pas en production.');
  }
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
    const { seasonId, status } = await seedFictionalSeason(dataSource);
    const route = status === 'active' ? '/api/seasons/current/standings' : `/api/seasons/${seasonId}/standings`;
    console.log(`Saison fictive chargée (${status === 'active' ? 'saison en cours' : 'terminée : une autre saison est déjà active'}).`);
    console.log(`Classement : http://localhost:4200${route}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
