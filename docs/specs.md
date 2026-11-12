# Porolympiques — règlement et specs

> Export du doc de specs, version du 12 novembre 2026. La source de vérité est le doc d'origine : ce fichier se régénère quand une règle change, il ne se modifie pas à la main.

## En bref

Les Porolympiques sont un circuit de tournois entre potes sur Discord, par saisons de 6 mois, où chacun joue aux jeux qui lui plaisent sans être pénalisé pour les autres.

- **Rythme** : un main event par mois, plus des side events ponctuels qui comptent moitié moins.
- **Classement de saison** : les 3 meilleurs résultats en main event et les 2 meilleurs en side event.
- **Formats** : asynchrones par défaut (défis à score ou à chrono, matchs que les joueurs calent entre eux). Le live sert aux finales et aux jeux qui l'imposent (MOBA, deathmatch).
- **Outils** : le site web est l'outil principal, surtout pour la boîte à idées. Le bot Discord sert de vitrine, avec quelques actions rapides.
- **Choix des jeux** : une boîte à idées avec upvotes. Le vainqueur du main précédent choisit dans le top 5.
- **Résultats** : arbres sur Challonge, places finales saisies à la main par l'admin.
- **Retours** : les joueurs proposent et votent des améliorations sur le site, à côté de la roadmap.

Ce format répond aux deux essais précédents. Le tournoi multi-jeux perdait ceux qui n'aimaient que 2 ou 3 jeux sur 10. Le tournoi mensuel butait sur la disponibilité de tous le même soir.

## Règlement

Une saison dure 6 mois et se joue sur les meilleurs résultats de chacun, pas sur l'assiduité.

### Déroulé d'un main event

1. Le 1er du mois : annonce du jeu et du format, ouverture des inscriptions.
2. Trois semaines d'entraînement, avec un défi asynchrone qui sert de qualification ou de seeding.
3. Dernière semaine : matchs et finale. En format asynchrone, seule la finale demande d'être disponible le même soir.
4. Publication des résultats et du classement mis à jour.

L'asynchrone est privilégié quand on fixe les règles d'un tournoi, sans être obligatoire. Quand le jeu impose du live (MOBA, deathmatch), l'event se joue sur une vraie soirée. Pour le MVP, la date est fixée à la main avec les joueurs.

### Side events

N'importe quel membre peut en organiser un, sur le jeu de son choix. Pour le MVP, l'admin crée l'event sur le site au nom de l'hôte. Pour compter au classement, un side event doit :

- réunir au moins 4 joueurs classés, pas seulement inscrits ;
- être annoncé au moins une semaine avant et ouvert à tous ;
- être validé par l'admin.

### Barème

Un seul barème, avec un coefficient par type d'event : 1 pour un main, 0,5 pour un side.

| Place | Main (points) | Side (points) |
| --- | --- | --- |
| 1 | 24 | 12 |
| 2 | 18 | 9 |
| 3 | 14 | 7 |
| 4 | 12 | 6 |
| 5 | 10 | 5 |
| 6 | 8 | 4 |
| 7 | 6 | 3 |
| 8 | 4 | 2 |
| 9 et plus | 2 | 1 |

Le score de saison additionne les 3 meilleurs mains et les 2 meilleurs sides, soit 96 points au maximum. Ces deux quotas sont des paramètres de la saison.

### Cas particuliers

- **Event par équipe** : chaque membre prend les points de la place de son équipe. Les équipes sont composées à la main, et l'admin les saisit sur la page admin.
- **Ex æquo dans un event** (demi-finalistes sans petite finale) : les deux prennent les points de la 3e place.
- **Inscrit mais pas joué** : non classé, zéro point.
- **Égalité au classement de saison** : le meilleur résultat non compté départage, puis le nombre de victoires.
- **Invités** : un membre peut inviter des potes à un event, sans limite de nombre. Seule règle : l'invité rejoint le serveur Discord, ce qui le valide sur le site et le bot. Une fois sur le serveur et connecté, c'est un joueur comme les autres, qui compte au classement général.

## Choix du jeu et boîte à idées

On upvote un format, pas un jeu : « Minecraft Speedrun » et « Minecraft Fallen Kingdom » sont deux idées distinctes rattachées au même jeu.

### Boîte à idées

- **Jeu** : trouvé par autocomplete (IGDB) ou saisi librement pour les idées hors catalogue (Archipelago, speedrun Wikipédia).
- **Format** : un nom, une courte description, solo ou équipe, asynchrone ou live. Un jeu peut porter plusieurs formats.
- **Tranche de prix** : gratuit, moins de 10 €, 10 à 30 €, plus de 30 €. Choisie à la main par celui qui suggère.
- **Vote** : un upvote par membre et par format, retirable.
- **Statut** : proposé, ou retenu pour un event. Une fois joué, un format reste dans la liste avec la mention « Joué N fois », et ses votes repartent de zéro.
- **Doublons et modération** : avant l'ajout d'un format, le formulaire montre ceux qui existent déjà pour ce jeu. L'admin peut corriger ou supprimer une idée.

### Choix du jeu

- **Main event** : le vainqueur du main précédent choisit parmi les 5 formats les plus upvotés. Si une équipe a gagné, le premier de ses membres à choisir l'emporte.
- **Champion absent** : sans choix dans les 3 jours qui suivent sa victoire, le format le plus upvoté passe.
- **Tout premier main** : le format le plus upvoté, faute de vainqueur précédent. Ensuite, le vainqueur du dernier main d'une saison choisit le premier de la suivante.
- **Side event** : libre choix de l'hôte, sans passer par la boîte à idées. Le format est créé avec l'event s'il n'existe pas encore.
- **Dernier mot à l'admin** : il peut changer le jeu d'un event, si le champion se manifeste après coup ou si le groupe décide d'en changer.

## Bot Discord

Le bot est la vitrine dans Discord : il annonce, affiche et renvoie vers le site, avec quelques actions rapides. Il reconnaît un joueur par son identifiant Discord, sans connexion préalable au site. Les noms de commandes sont provisoires.

| Commande | Pour qui | Effet |
| --- | --- | --- |
| `/leaderboard` | Tous | Classement de la saison en cours, ou d'une saison passée en option |
| `/event` | Tous | Event en cours ou à venir : jeu, format, dates, inscrits, lien Challonge |
| `/join` | Tous | Inscription à un event, aussi disponible en bouton sous l'annonce |
| `/list-games` | Tous | Top de la boîte à idées, avec un bouton d'upvote par format |
| `/add-game` | Tous | Suggestion d'un jeu et d'un format, avec autocomplete IGDB ou saisie libre |
| `/profile` | Tous | Résultats et médailles d'un joueur |
| `/season-create` | Admin (V2) | Création d'une saison : dates, barème, quotas |
| `/event-create` | Admin (V2) | Création d'un main ou d'un side : jeu, format, dates, hôte |
| `/event-results` | Admin (V2) | Saisie des places finales, qui clôt l'event |

### Messages automatiques

- Annonce d'un event dans le salon dédié, avec le bouton d'inscription et un lien vers la page du site.
- Rappels avant la fin des inscriptions et avant la date limite des matchs (V2).
- Résultats et classement mis à jour à la clôture d'un event, avec un lien vers le site.
- Attribution du rôle Discord « champion en titre » au vainqueur du dernier main (V2).

## Site web

Le site est l'outil principal : on y suggère et upvote des formats, on s'y inscrit et on y suit les saisons. Il garde aussi l'historique. Il est en français, utilisable sur mobile, et affiche les dates en heure de Paris.

| Page | Contenu |
| --- | --- |
| Accueil | Event en cours, prochain event, top 5 du classement |
| Classement | Saison en cours par défaut, sélecteur de saison. Pour chaque joueur : résultats comptés, résultats écartés en grisé |
| Events | Timeline : à venir, en cours, passés |
| Event (détail) | Jeu, format, règles, dates, hôte, inscrits, résultats, lien Challonge |
| Joueur | Historique des résultats, médailles, trophées de saison |
| Boîte à idées | Formats triés par upvotes, mention « Joué N fois », filtres par tranche de prix et par mode, formulaire de suggestion |
| Suggestions | Améliorations proposées triées par score, vote pour ou contre, filtres par catégorie et par statut, formulaire de proposition, vue roadmap |
| Palmarès | Champions et podiums des saisons passées |
| Admin | Création de saison et d'event, saisie des résultats, validation des side events, changement du jeu d'un event, saisie des équipes, gestion de la roadmap |

### Authentification

- Connexion par OAuth Discord uniquement, obligatoire pour tout le site : aucune page n'est publique.
- Accès réservé aux membres du serveur Discord, invités compris : rejoindre le serveur vaut validation. La présence sur le serveur est vérifiée à chaque inscription et à chaque connexion : qui l'a quitté est refusé, et sa session en cours est coupée. Ses résultats passés restent affichés.
- Deux rôles pour le MVP : admin et joueur.
- L'admin est désigné par configuration, avec son identifiant Discord.
- Le site ne stocke que l'identifiant, le pseudo et l'avatar Discord, pas d'e-mail.

### Médailles

- Or, argent et bronze pour les podiums de main event.
- Une version plus discrète pour les podiums de side event.
- Un trophée pour le champion de chaque saison.
- Tout est calculé à partir des places : rien de plus à stocker.

### Suggestions d'amélioration

Les joueurs proposent sur le site des améliorations du format, du site, du bot ou de l'organisation, et l'admin pioche dedans pour sa roadmap. C'est distinct de la boîte à idées, qui ne sert qu'à choisir les jeux.

- **Proposer** : tout joueur connecté, avec un titre, une description et une catégorie (format, site, bot, process).
- **Voter** : pour ou contre, un vote par joueur et par suggestion, modifiable ou retirable. Le score est la différence entre les pour et les contre.
- **Trier** : par score par défaut, avec un filtre par catégorie et par statut.
- **Roadmap** : l'admin ajoute une suggestion à la roadmap ou l'en retire d'un clic, depuis la liste. Tous les joueurs consultent la roadmap sur la même page que les suggestions. Statuts : proposée, dans la roadmap, livrée.
- **Modérer** : l'admin peut supprimer une suggestion, l'auteur peut supprimer la sienne tant qu'elle n'est pas dans la roadmap.

## Modèle de données

On stocke les places, jamais les points : le classement se recalcule à partir du barème de la saison, qu'on peut donc ajuster sans rien ressaisir.

| Entité | Champs principaux | Notes |
| --- | --- | --- |
| `Player` | `discord_id` (unique), `pseudo`, `avatar_url`, `role` (admin, player), `active` | Créé par synchro des membres du serveur, donc avant toute connexion au site. `active` passe à faux quand il quitte le serveur, ce qui bloque sa connexion |
| `Season` | `name`, `start_date`, `end_date`, `scoring_scale` (JSON place → points), `main_quota`, `side_quota`, `status` (upcoming, active, finished) | Quotas par défaut : 3 et 2. Une seule saison active à la fois |
| `Game` | `source` (igdb, custom), `external_id` (nullable), `name`, `cover_url`, `price_tier` (free, lt10, 10to30, gt30) | Sert aussi de cache local du catalogue |
| `Format` | `game_id`, `name`, `description`, `team_mode` (solo, team), `play_mode` (async, live), `status` (proposed, selected), `suggested_by` | Unité upvotée et choisie pour un event. Repasse en `proposed` une fois joué. « Joué N fois » se calcule à partir des events terminés |
| `Vote` | `player_id`, `format_id` | Paire unique. Les votes d'un format sont supprimés à la clôture de l'event qui le joue |
| `Event` | `season_id`, `format_id`, `type` (main, side), `coefficient`, `status`, `rules`, `announce_date`, `registration_end`, `end_date`, `live_date` (nullable), `host_id`, `challonge_url`, `validated` | Statuts : announced, registration, in_progress, finished, cancelled. `format_id` est obligatoire, même pour un side. `live_date` ne sert qu'aux events joués en live |
| `Team` | `event_id`, `name` | Seulement pour les events par équipe |
| `Registration` | `event_id`, `player_id`, `team_id` (nullable) | Paire event et joueur unique |
| `Result` | `event_id`, `player_id`, `place` (nullable) | `place` non unique (ex æquo), vide si non classé |
| `Suggestion` | `author_id`, `title`, `description`, `category` (format, site, bot, process), `status` (proposed, planned, done) | Amélioration proposée par un joueur. `planned` = dans la roadmap |
| `SuggestionVote` | `suggestion_id`, `player_id`, `value` (+1, -1) | Paire unique. Le score d'une suggestion est la somme des votes, calculée à la demande |
| `CatalogSearchCache` | `query` normalisée, `results` (JSON), `fetched_at` | Expire après quelques heures |

### Règles de calcul

- **Points d'un résultat** : `scoring_scale[place] × coefficient`. Zéro si non classé.
- **Side event** : ne compte que s'il est validé et réunit au moins 4 joueurs classés.
- **Score de saison** : somme des `main_quota` meilleurs résultats en main et des `side_quota` meilleurs en side.
- **Départage** : meilleur résultat non compté, puis nombre de victoires.
- **Classement et médailles** : calculés à la demande (requête ou vue), jamais stockés.
- **Droit de choix du jeu** : il revient aux joueurs classés premiers du dernier main terminé, pendant 3 jours après sa clôture. Pour une équipe gagnante, n'importe quel membre peut choisir et le premier choix enregistré compte.
- **Tests** : le calcul du classement est couvert par des tests unitaires (quotas, ex æquo, side non validé, départage).

## Stack et intégrations

La stack reprend la base de kanadrill, pour repartir d'un socle connu, avec IGDB et Challonge en services externes.

### Stack retenue

- **Monorepo** : Nx, avec le front, l'API et les libs de domaine partagées.
- **Front** : Angular et Tailwind.
- **API** : NestJS et TypeORM sur Postgres.
- **Auth** : OAuth Discord via Passport, session en JWT dans un cookie.
- **Bot** : discord.js, dans le même backend NestJS que l'API pour partager les services et la base. Le bot et l'API vivent dans deux libs Nx séparées, ce qui permettra de sortir le bot dans sa propre app plus tard si besoin.
- **Déploiement** : conteneur Docker sur le VPS derrière Caddy, déployé par GitHub Actions à chaque push sur master. Adresse : porolympiques.tongcho7.com, avec un passage possible à porolympiques.com plus tard.

### Configuration

Tout ce qui dépend du serveur Discord ou d'un service externe passe par des variables d'environnement, jamais par le code.

- **Discord** : identifiants de l'application OAuth, jeton du bot, identifiant du serveur, salon des annonces, identifiants des admins.
- **IGDB** : identifiants de l'application Twitch.
- **Application** : URL de la base Postgres, secret de signature des sessions, URL publique du site.

### Discord

- OAuth avec le scope `identify`. L'appartenance au serveur se vérifie côté bot, à chaque inscription et à chaque connexion.
- Le bot a besoin des slash commands, des boutons, de l'autocomplete (25 choix au maximum par réponse) et de la permission de gérer les rôles.
- La synchro des membres demande l'intent privilégié « Server Members », à activer dans le portail développeur. Le même intent signale un départ : le bot désactive alors le compte, et l'API refuse ses sessions dès la requête suivante.

### IGDB

- Accès par une application Twitch (client id et secret), appels côté serveur uniquement.
- Limites relevées le 12 novembre 2026, à revérifier dans la doc IGDB : 4 requêtes par seconde, gratuit pour un usage non commercial.
- Le catalogue passe par un port `GameCatalog` avec un adapter IGDB, pour pouvoir ajouter une autre source sans toucher au domaine.
- Ordre de recherche de l'autocomplete : table `Game` locale, puis cache de recherche, puis IGDB.
- Un jeu suggéré est enregistré dans `Game` et ne redemande plus d'appel.

### Challonge

Aucune intégration pour le MVP : l'event stocke seulement le lien de l'arbre, et l'admin saisit les places finales.

### Prix des jeux

Pas d'API de prix pour le MVP, la tranche est saisie à la main. Une source comme IsThereAnyDeal pourra la préremplir plus tard, derrière le même principe de port et d'adapter.

## Découpage

Le MVP permet de jouer une première saison complète avec un seul admin et des scores saisis à la main.

### MVP, dans l'ordre de dev

1. Auth OAuth Discord avec vérification de présence sur le serveur, joueurs, synchro des membres et désactivation au départ. Le bot doit donc déjà être connecté au serveur à cette étape.
2. Schéma de base : saisons, jeux, formats, events, inscriptions, résultats, suggestions.
3. Calcul du classement de saison, avec les quotas et le départage.
4. Site : boîte à idées, avec autocomplete IGDB et cache, saisie libre, formats et upvotes.
5. Site : events, inscription, classement, page joueur avec médailles.
6. Site : page admin pour créer une saison ou un event, saisir les équipes et les résultats, valider un side event et changer le jeu d'un event.
7. Site : suggestions d'amélioration, avec votes pour ou contre et gestion de la roadmap par l'admin.
8. Bot : annonces automatiques avec lien vers le site (nouvel event, résultats, classement).
9. Bot : commandes `/leaderboard`, `/event`, `/join`, `/list-games`, `/add-game` et `/profile`.

### V2

- Soumission des scores par les joueurs, avec capture en preuve et validation de l'admin.
- Rôle « hôte » pour qu'un membre crée lui-même un side event.
- Rappels automatiques avant les dates limites.
- Rôle Discord « champion en titre » attribué automatiquement.
- Commandes admin dans le bot (`/season-create`, `/event-create`, `/event-results`), en doublon de la page admin du site.
- Tranche de prix préremplie par une API de prix.
- Sondage de disponibilités pour fixer la soirée d'un event live.

### Plus tard

- Ladder à défis permanent pour les jeux en 1v1.
- Showmatch contre un autre Discord, voire plusieurs serveurs sur la même instance.
- Badges fantaisie (hôte, tous les mains joués).
