#!/usr/bin/env bash
# Vide les données de test de la PROD avant la saison 1. À lancer sur le VPS, depuis le dossier de la stack :
#   cd ~/stacks/porolympiques && scripts/purge-test-data.sh
# Garde les joueurs, les suggestions et leurs votes. Sauvegarde la base avant, et demande confirmation.
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR="$HOME/data/dumps/porolympiques"
SQL="scripts/purge-test-data.sql"

psql_db() {
  docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"
}

counts() {
  psql_db -At -F ' : ' -c "
    SELECT 'saisons', count(*) FROM seasons UNION ALL
    SELECT 'events', count(*) FROM events UNION ALL
    SELECT 'résultats', count(*) FROM results UNION ALL
    SELECT 'jeux', count(*) FROM games UNION ALL
    SELECT 'formats', count(*) FROM formats UNION ALL
    SELECT 'votes (idées)', count(*) FROM votes UNION ALL
    SELECT 'sessions', count(*) FROM auth_sessions UNION ALL
    SELECT 'joueurs (gardés)', count(*) FROM players UNION ALL
    SELECT 'suggestions (gardées)', count(*) FROM suggestions UNION ALL
    SELECT 'votes des suggestions (gardés)', count(*) FROM suggestion_votes" < /dev/null
}

# Les `docker compose exec` lisent l'entrée standard : on la leur ferme (< /dev/null), sauf pour envoyer le SQL.
if ! docker compose ps --status running --services 2>/dev/null | grep -qx db; then
  echo "Le conteneur db ne tourne pas : rien à faire." >&2
  exit 1
fi

echo "==> Contenu actuel"
counts
echo
echo "Seront vidés : saisons, events, inscriptions, équipes, résultats, jeux, formats, votes de la boîte à idées,"
echo "cache du catalogue, sessions et images envoyées. Les messages déjà postés sur Discord restent : supprime-les à la main."
read -r -p "Tape PURGER pour continuer : " answer
if [[ "$answer" != "PURGER" ]]; then
  echo "Annulé."
  exit 1
fi

echo "==> Sauvegarde de la base"
mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/pre-purge-$(date +%F-%H%M%S).sql.gz"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' < /dev/null | gzip > "$backup"
echo "    $backup"

echo "==> Purge"
psql_db -1 < "$SQL"

if docker compose ps --status running --services 2>/dev/null | grep -qx api; then
  echo "==> Images envoyées"
  docker compose exec -T api sh -c 'find "${UPLOADS_DIR:-/data/uploads}" -mindepth 1 -delete' < /dev/null
else
  echo "L'API ne tourne pas : les images envoyées n'ont pas été effacées (volume porolympiques-uploads)." >&2
fi

echo "==> Après la purge"
counts
echo "Terminé. Les joueurs se reconnectent ; tu peux créer la saison 1 sur /admin."
