# Porolympiques

Site web et bot Discord pour un circuit de tournois de jeux vidéo entre potes : saisons de 6 mois, classement, boîte à idées de jeux et suggestions d'amélioration. Le site est l'outil principal, le bot sert de vitrine dans Discord.

## À lire avant de coder

- `docs/specs.md` : règlement, pages, modèle de données, stack et intégrations. C'est la référence fonctionnelle.
- `docs/plan.md` : les phases de mise en place, dans l'ordre, chacune avec son critère de fin.

Ces deux fichiers sont des exports d'un doc tenu ailleurs. Ne pas les modifier : signaler ce qui devrait changer, la correction se fait à la source.

## Façon de travailler

- Une phase de `docs/plan.md` égale une branche. Ne pas déborder sur la phase suivante.
- Proposer un plan et attendre la validation avant d'écrire du code.
- Écrire les tests avec le code. Le calcul du classement doit toujours être couvert.
- Si une règle des specs semble ambiguë ou contradictoire, poser la question plutôt que trancher.
- En fin de phase, rappeler le critère « Terminée quand » et dire comment le vérifier à la main.

## Stack

- Monorepo Nx, sur la même base que le dépôt `kanadrill` (structure, auth Discord, déploiement).
- Front : Angular et Tailwind.
- API : NestJS et TypeORM sur Postgres.
- Auth : OAuth Discord via Passport, session en JWT dans un cookie.
- Bot : discord.js, dans le même backend NestJS que l'API, mais dans sa propre lib Nx.
- Catalogue de jeux : port `GameCatalog` avec un adapter IGDB et un cache local.
- Déploiement : Docker sur un VPS derrière Caddy, par GitHub Actions à chaque push sur master.

## Conventions

- Code, entités et champs en anglais, avec les noms donnés dans les specs. Interface du site et messages du bot en français.
- Les règles métier vivent dans les libs de domaine, jamais dans les contrôleurs, le bot ou le front.
- Le domaine ne dépend ni de Discord ni d'IGDB : ports et adapters.
- On stocke les places, jamais les points. Le classement, les médailles et « Joué N fois » sont calculés à la demande.
- Configuration par variables d'environnement uniquement, avec un `.env.example` tenu à jour. Aucun identifiant ni secret dans le code.
- Schéma géré par migrations TypeORM, sans `synchronize` en production.
- Dates stockées en UTC, affichées en heure de Paris.
- Toutes les routes de l'API sont derrière l'authentification, et vérifient que le joueur est encore actif. Seule exception : `GET /api/health`, pour le healthcheck et le déploiement.

## Commandes

- `npm install`, puis `npm run db:up` : PostgreSQL de dev sur le port 5433 (Adminer sur 8082). Config locale dans `.env` (voir `.env.example`, section développement).
- `npm run dev:api` et `npm run dev:web` : API (port 3000) et front (port 4200, proxy `/api`).
- `npm run lint` et `npm run test`. Tests d'intégration : `TEST_DATABASE_URL=postgres://porolympiques:devpass@127.0.0.1:5433/porolympiques_test npx nx test api`. Le nom de la base doit contenir « test ».
- `npm run migration:generate -- apps/api/src/app/database/migrations/Nom`, puis ajouter la migration à `MIGRATIONS` (`database/migrations/index.ts`) et toute nouvelle entité à `ENTITIES` (`database/entities.ts`).
- Production : `docker compose up -d --build`, lancé par `scripts/deploy.sh` (voir `README.md`).

## Structure

- `apps/api` démarre le backend (config, base, migrations). `apps/web` est le front.
- `libs/domain`, `libs/api` (projet Nx `api-lib`), `libs/bot`, `libs/shared` : alias `@porolympiques/<lib>`.
- Les frontières entre projets sont vérifiées par le lint (`eslint.config.mjs`) : ne pas les contourner.
