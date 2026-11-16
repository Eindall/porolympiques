-- Vide les données de test avant la saison 1 (lancé par scripts/purge-test-data.sh, dans une transaction).
-- Gardés : les joueurs (les suggestions en dépendent, et la synchro du bot les tient à jour), les suggestions
-- et leurs votes, et l'historique des migrations.
-- Vidés : saisons, events (inscriptions, équipes, résultats), jeux, formats et votes de la boîte à idées,
-- cache du catalogue, sessions (chacun se reconnecte).
TRUNCATE seasons, events, registrations, teams, results, games, formats, votes, catalog_search_cache, auth_sessions;
