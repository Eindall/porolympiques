import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pistes déjà notées dans les specs, reprises comme suggestions de l'admin : la V2 dans la roadmap (`planned`),
 * le « plus tard » en simples propositions. Sans joueur admin en base (il faut s'être connecté une fois),
 * rien n'est inséré. Une suggestion de même titre déjà présente n'est pas doublée.
 */
export const ROADMAP_SUGGESTIONS: { title: string; description: string; category: string; status: string }[] = [
    { title: 'Soumission des scores par les joueurs', description: 'Chacun envoie son score avec une capture en preuve, l’admin valide.', category: 'site', status: 'planned' },
    { title: 'Rôle « hôte » pour créer un side event', description: 'Un membre crée lui-même un side event, sans passer par l’admin.', category: 'site', status: 'planned' },
    { title: 'Rappels automatiques avant les dates limites', description: 'Le bot rappelle la fin des inscriptions et la date limite des matchs.', category: 'bot', status: 'planned' },
    { title: 'Rôle Discord « champion en titre »', description: 'Attribué automatiquement au vainqueur du dernier main.', category: 'bot', status: 'planned' },
    { title: 'Commandes admin dans le bot', description: '/season-create, /event-create et /event-results, en doublon de la page admin du site.', category: 'bot', status: 'planned' },
    { title: 'Tranche de prix préremplie par une API de prix', description: 'Par exemple IsThereAnyDeal, pour ne plus saisir la tranche à la main.', category: 'site', status: 'planned' },
    { title: 'Sondage de disponibilités pour les events live', description: 'Pour fixer la soirée d’un event live.', category: 'process', status: 'planned' },
    { title: 'Ladder à défis permanent', description: 'Pour les jeux en 1v1, en continu à côté de la saison.', category: 'format', status: 'proposed' },
    { title: 'Showmatch contre un autre Discord', description: 'Voire plusieurs serveurs sur la même instance.', category: 'format', status: 'proposed' },
    { title: 'Badges fantaisie', description: 'Hôte d’un event, tous les mains joués d’une saison…', category: 'site', status: 'proposed' },
];

export class RoadmapSuggestions1794843631066 implements MigrationInterface {
    name = 'RoadmapSuggestions1794843631066'

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const [index, item] of ROADMAP_SUGGESTIONS.entries()) {
            // Dates décalées d'une milliseconde : à score égal, l'ordre de la liste reste celui des specs.
            await queryRunner.query(
                `INSERT INTO "suggestions" ("author_id", "title", "description", "category", "status", "created_at", "updated_at")
                 SELECT p.id, $1::varchar, $2::text, $3::varchar, $4::varchar, now() + $5::int * interval '1 millisecond', now() + $5::int * interval '1 millisecond'
                   FROM "players" p
                  WHERE p.role = 'admin'
                    AND NOT EXISTS (SELECT 1 FROM "suggestions" s WHERE s.title = $1::varchar)
                  ORDER BY p.created_at
                  LIMIT 1`,
                [item.title, item.description, item.category, item.status, index],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "suggestions" WHERE "title" = ANY($1)`, [ROADMAP_SUGGESTIONS.map((item) => item.title)]);
    }

}
