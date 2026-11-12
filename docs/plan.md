# Plan de bataille

> Export de l'onglet « Plan de bataille » du doc, version du 12 novembre 2026. L'avancement se coche dans le doc d'origine.

Neuf phases dans l'ordre, du compte Discord à créer jusqu'à l'annonce du premier main. Chaque phase se termine sur quelque chose de vérifiable à la main.

## Vue d'ensemble

| Phase | Contenu | Terminée quand |
| --- | --- | --- |
| 0. Préparatifs | Applications Discord et Twitch, dépôt, DNS | Tous les identifiants sont notés et le bot est sur le serveur |
| 1. Socle | Monorepo, base, CI, déploiement | Un push sur master met une page vide en ligne à l'adresse du site |
| 2. Auth et joueurs | OAuth Discord, mur de connexion, synchro des membres | Un membre se connecte, un non-membre est refusé, un départ coupe la session |
| 3. Modèle et classement | Entités, migrations, calcul du classement | Les tests du classement passent sur une saison fictive |
| 4. Boîte à idées | Catalogue IGDB, formats, upvotes | Un joueur propose un format par autocomplete, un autre l'upvote |
| 5. Saisons et events | Page admin, events, inscriptions, classement, joueurs | Une saison de test se joue de bout en bout sur le site |
| 6. Suggestions | Propositions, votes, roadmap | Une suggestion votée passe dans la roadmap, visible de tous |
| 7. Bot | Annonces et commandes | Créer un event sur le site déclenche l'annonce sur Discord |
| 8. Lancement | Recette entre potes, sauvegardes, saison 1 | Le premier main est annoncé |

L'ordre suit celui du MVP dans `docs/specs.md`. Les phases 4 et 6 ne dépendent que des phases 1 à 3 : elles peuvent changer de place. La phase 7 a besoin de la 5.

## Méthode

Une phase égale une branche, fusionnée quand son critère de fin est vérifié à la main sur le site déployé.

- Les specs vivent dans `docs/specs.md`, et `CLAUDE.md` y renvoie avec la stack et les conventions de kanadrill.
- En début de phase, donner à Claude Code la phase à traiter et lui demander un plan avant d'écrire du code.
- Demander les tests en même temps que le code, surtout pour le classement.
- Quand une règle change en route, corriger d'abord le doc d'origine, puis régénérer `docs/specs.md` et ce fichier.

## Phase 0 : préparatifs

Tout ce qui se fait à la main, hors code, pour que la phase 1 ne bloque sur aucun identifiant.

- [ ] Créer l'application Discord dans le portail développeur, avec son bot.
- [ ] Activer l'intent privilégié « Server Members » sur le bot.
- [ ] Déclarer les URL de retour OAuth : celle du site et celle du poste de dev.
- [ ] Inviter le bot sur le serveur, avec le droit de poster dans le salon des annonces et de gérer les rôles.
- [ ] Noter l'identifiant du serveur, celui du salon des annonces et le tien, pour le rôle admin.
- [ ] Créer l'application Twitch qui donne accès à IGDB.
- [ ] Créer le dépôt GitHub.
- [ ] Pointer porolympiques.tongcho7.com vers le VPS.

**Terminée quand** : tous les identifiants sont notés en lieu sûr et le bot apparaît dans la liste des membres du serveur.

## Phase 1 : socle technique

Un squelette vide mais déployé, pour que chaque phase suivante parte en ligne dès sa fusion.

- [ ] Générer le monorepo Nx sur la base de kanadrill : front Angular et Tailwind, API NestJS, libs de domaine, d'API et de bot.
- [ ] Brancher Postgres en local avec Docker, et TypeORM avec des migrations.
- [ ] Écrire `CLAUDE.md` et déposer `docs/specs.md`.
- [ ] Lancer le lint et les tests dans GitHub Actions.
- [ ] Écrire le Dockerfile et le `compose.yml`, avec les variables de la section Configuration des specs.
- [ ] Créer la base sur le Postgres du VPS et déclarer le sous-domaine dans Caddy.
- [ ] Brancher le déploiement automatique à chaque push sur master.

**Terminée quand** : un push sur master met en ligne une page d'accueil vide à l'adresse du site.

## Phase 2 : auth et joueurs

Le site reconnaît les membres du serveur Discord, et personne d'autre.

- [ ] Connexion OAuth Discord avec Passport, session en JWT dans un cookie.
- [ ] Mur de connexion sur toutes les pages et toutes les routes de l'API.
- [ ] Connecter le bot au serveur et synchroniser les membres dans `Player`.
- [ ] Vérifier la présence sur le serveur à chaque connexion.
- [ ] Désactiver le compte quand un membre quitte le serveur, et refuser ses sessions.
- [ ] Attribuer le rôle admin par configuration.
- [ ] Page de profil minimale : pseudo, avatar, déconnexion.

**Terminée quand** : tu te connectes, un compte hors serveur est refusé, et un compte de test qui quitte le serveur perd sa session.

## Phase 3 : modèle et classement

La règle la plus délicate du projet, écrite et testée avant toute interface.

- [ ] Créer les entités et les migrations décrites dans les specs.
- [ ] Écrire le calcul du classement : barème, coefficient, quotas, départage.
- [ ] Couvrir les cas limites par des tests : ex æquo, non classé, side non validé ou à moins de 4 classés, égalité au score.
- [ ] Écrire un jeu de données de test : une saison fictive avec quelques joueurs, mains et sides.
- [ ] Exposer le classement par une route de l'API.

**Terminée quand** : les tests passent, et la route renvoie le classement attendu pour la saison fictive.

## Phase 4 : boîte à idées

La première fonctionnalité visible, et de quoi remplir la liste avant le premier main.

- [ ] Port `GameCatalog` et adapter IGDB, avec le jeton Twitch renouvelé automatiquement.
- [ ] Cache : table `Game` locale, puis cache de recherche, puis IGDB.
- [ ] Formulaire : jeu par autocomplete ou saisie libre, format, mode, tranche de prix.
- [ ] Afficher les formats déjà proposés pour le jeu avant l'ajout, pour éviter les doublons.
- [ ] Liste triée par upvotes, avec filtres et mention « Joué N fois ».
- [ ] Upvote et retrait du vote.
- [ ] Correction et suppression d'une idée par l'admin.

**Terminée quand** : un joueur propose un format par autocomplete, un autre l'upvote, et une idée hors catalogue passe aussi.

## Phase 5 : saisons, events et pages du site

Le cœur du produit, de la création d'une saison au classement affiché. C'est la plus grosse phase : elle peut se couper en deux branches, l'admin d'abord, les pages ensuite.

- [ ] Page admin : créer une saison, créer un event main ou side, saisir les équipes.
- [ ] Inscription d'un joueur à un event.
- [ ] Page admin : saisir les places finales, valider un side, changer le jeu d'un event.
- [ ] À la clôture d'un event, remettre à zéro les votes du format joué.
- [ ] Choix du jeu suivant par le vainqueur : top 5, délai de 3 jours, premier choix enregistré pour une équipe.
- [ ] Pages Events (timeline) et détail d'un event.
- [ ] Page Classement, avec résultats comptés et écartés, et sélecteur de saison.
- [ ] Page Joueur avec médailles, page Palmarès, page d'accueil.

**Terminée quand** : une saison de test se joue de bout en bout sur le site, avec un main, un side et un event par équipe.

## Phase 6 : suggestions d'amélioration

De quoi récolter des retours dès la première saison.

- [ ] Formulaire : titre, description, catégorie.
- [ ] Vote pour ou contre, modifiable et retirable, avec le score calculé.
- [ ] Liste triée par score, avec filtres par catégorie et par statut.
- [ ] Actions admin : ajouter à la roadmap, retirer, marquer livrée, supprimer.
- [ ] Vue roadmap sur la même page, visible de tous.
- [ ] Suppression par l'auteur tant que la suggestion n'est pas dans la roadmap.

**Terminée quand** : une suggestion votée par deux comptes passe dans la roadmap, et un compte joueur la voit.

## Phase 7 : bot vitrine

Le bot ramène les gens vers le site, depuis l'endroit où ils sont déjà.

- [ ] Annonce d'un nouvel event dans le salon, avec bouton d'inscription et lien vers le site.
- [ ] Message de résultats et de classement à la clôture d'un event.
- [ ] Commandes `/leaderboard`, `/event` et `/join`.
- [ ] Commandes `/list-games`, avec upvote, et `/add-game`, avec autocomplete.
- [ ] Commande `/profile`.

**Terminée quand** : créer puis clôturer un event sur le site poste les deux messages sur Discord, et chaque commande répond.

## Phase 8 : lancement

La mise en service, une fois que tout tient debout.

- [ ] Recette avec deux ou trois potes sur une saison de test, puis corrections.
- [ ] Ajouter la base aux sauvegardes du VPS et vérifier une restauration.
- [ ] Ajouter le site à la supervision du VPS.
- [ ] Vider les données de test.
- [ ] Préremplir la boîte à idées avec quelques formats.
- [ ] Fixer les dates de la saison 1 et la créer.
- [ ] Écrire le message d'annonce et une version courte du règlement pour le Discord.
- [ ] Annoncer le premier main.

**Terminée quand** : le premier main est annoncé sur le Discord et les inscriptions sont ouvertes.
