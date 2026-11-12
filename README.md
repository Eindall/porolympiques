# Porolympiques

Site web et bot Discord pour un circuit de tournois de jeux vidéo entre potes. Specs dans [`docs/specs.md`](docs/specs.md), phases de mise en place dans [`docs/plan.md`](docs/plan.md).

**Stack** : Nx · NestJS, TypeORM et PostgreSQL · Angular et Tailwind · Docker Compose derrière Caddy.

```
apps/api       Démarrage du backend NestJS : config, base, migrations
apps/web       Front Angular
libs/domain    Règles métier, sans Discord ni IGDB          (@porolympiques/domain)
libs/api       Contrôleurs HTTP de l'API                    (@porolympiques/api)
libs/bot       Bot Discord, chargé dans le même backend     (@porolympiques/bot)
libs/shared    Types partagés entre le front et le backend  (@porolympiques/shared)
```

Les dépendances autorisées entre projets sont vérifiées par le lint (`@nx/enforce-module-boundaries`, dans `eslint.config.mjs`) : le front ne voit que `shared`, l'API et le bot passent par `domain`, et `domain` n'importe ni Discord ni Angular.

## Développement

Prérequis : Node.js 22 ou plus, npm, Docker avec Compose.

```bash
npm install
npm run db:up                 # PostgreSQL (port 5433) et Adminer (http://localhost:8082)
cp .env.example .env          # puis garde seulement la section « Développement local », décommentée
npm run dev:api               # API sur http://localhost:3000/api
npm run dev:web               # front sur http://localhost:4200 (proxy /api vers :3000)
```

Ouvre <http://localhost:4200> plutôt que le port 3000 : le cookie de session et le retour OAuth passeront par le proxy du front.

### Base de données

Les migrations s'appliquent au démarrage de l'API. `synchronize` n'est jamais activé.

```bash
# Après avoir modifié une entité :
npm run migration:generate -- apps/api/src/app/database/migrations/NomDeLaMigration
# Puis ajoute la classe générée à MIGRATIONS (apps/api/src/app/database/migrations/index.ts)
# et toute nouvelle entité à ENTITIES (apps/api/src/app/database/entities.ts).

npm run migration:run         # appliquer à la main
npm run migration:revert      # annuler la dernière
```

### Tests et lint

```bash
npm run lint
npm run test
# Tests d'intégration, sur la base porolympiques_test créée par `npm run db:up` :
TEST_DATABASE_URL=postgres://porolympiques:devpass@127.0.0.1:5433/porolympiques_test npx nx test api
```

Sans `TEST_DATABASE_URL`, les tests d'intégration sont ignorés. Le nom de la base de test doit contenir « test », sinon ils refusent de démarrer.

Si la base de dev existait avant l'ajout de `scripts/dev-db-init.sql`, crée la base de test à la main :

```bash
docker compose -f docker-compose.dev.yml exec db createdb -U porolympiques porolympiques_test
```

## Production

Trois conteneurs : `db` (PostgreSQL dédié, volume persistant), `api` (NestJS et bot) et `web` (nginx, qui sert le front et renvoie `/api` vers l'API). Seul `web` rejoint le réseau Docker de Caddy, sous l'alias `porolympiques-web`.

La route de santé `GET /api/health` est la seule route publique de l'API. Elle vérifie aussi la base, et sert au healthcheck Docker comme au script de déploiement.

### Déploiement continu

À chaque push sur master, GitHub Actions lance le lint, les tests et le build, puis se connecte au VPS en SSH. La clé utilisée ne peut lancer que [`scripts/deploy.sh`](scripts/deploy.sh), qui reçoit seulement le SHA à déployer et fait dans l'ordre :

1. Vérifier que le commit fait partie de master.
2. Sauvegarder la base dans `~/data/dumps/porolympiques` (10 dernières sauvegardes gardées).
3. Mettre le code sur ce commit, reconstruire et redémarrer.
4. Attendre que `/api/health` réponde.

### Mise en place du VPS (une seule fois)

Sur le VPS, avec l'utilisateur qui fait tourner kanadrill :

```bash
git clone https://github.com/Eindall/porolympiques.git ~/stacks/porolympiques
cd ~/stacks/porolympiques
cp .env.example .env          # remplis la section « Production »
docker compose up -d --build
```

Clé de déploiement, sur ton poste :

```bash
ssh-keygen -t ed25519 -N '' -C github-deploy-porolympiques -f porolympiques_deploy
```

Ajoute la clé publique dans `~/.ssh/authorized_keys` sur le VPS, limitée au script :

```
command="/home/<utilisateur>/stacks/porolympiques/scripts/deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA… github-deploy-porolympiques
```

Secrets du dépôt GitHub (Settings → Secrets and variables → Actions) :

| Secret | Valeur |
| --- | --- |
| `VPS_SSH_KEY` | Contenu de la clé privée `porolympiques_deploy` |
| `VPS_KNOWN_HOSTS` | Sortie de `ssh-keyscan -p <port> <hôte>` |
| `VPS_HOST` | Adresse du VPS |
| `VPS_USER` | Utilisateur SSH |
| `VPS_PORT` | Port SSH, facultatif (22 par défaut) |

Bloc Caddy :

```
porolympiques.tongcho7.com {
	reverse_proxy porolympiques-web:80
}
```
