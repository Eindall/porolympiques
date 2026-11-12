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
- Toutes les routes de l'API sont derrière l'authentification, et vérifient que le joueur est encore actif.

## Commandes

À compléter en phase 1, une fois le squelette en place : installation, lancement local, base de dev, tests, lint, migrations.
