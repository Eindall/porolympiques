import { MigrationInterface, QueryRunner } from "typeorm";

export class GameSearchName1794595906591 implements MigrationInterface {
    name = 'GameSearchName1794595906591'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Rempli pour les jeux existants avant de devenir obligatoire. Postgres n'enlève pas les accents sans
        // extension : seule la casse est normalisée ici, l'application recalcule la forme complète à chaque écriture.
        await queryRunner.query(`ALTER TABLE "games" ADD "search_name" character varying(200)`);
        await queryRunner.query(`UPDATE "games" SET "search_name" = lower(regexp_replace(trim("name"), '\\s+', ' ', 'g'))`);
        await queryRunner.query(`ALTER TABLE "games" ALTER COLUMN "search_name" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "games_search_name" ON "games"  ("search_name") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."games_search_name"`);
        await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "search_name"`);
    }

}
