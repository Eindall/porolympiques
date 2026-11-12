-- Exécuté une seule fois, à la création du volume de la base de dev.
-- Base dédiée aux tests d'intégration : son nom doit contenir « test » (voir apps/api/jest.setup-env.ts).
CREATE DATABASE porolympiques_test OWNER porolympiques;
