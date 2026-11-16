import { MigrationInterface, QueryRunner } from "typeorm";

export class GameCover1794597246854 implements MigrationInterface {
    name = 'GameCover1794597246854'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "games" ADD "created_by" uuid`);
        await queryRunner.query(`ALTER TABLE "games" ADD "cover_file" character varying(64)`);
        // Jeux déjà enregistrés : leur créateur est l'auteur de la première idée proposée dessus.
        await queryRunner.query(
            `UPDATE "games" g SET "created_by" = (SELECT f."suggested_by" FROM "formats" f WHERE f."game_id" = g."id" ORDER BY f."created_at" LIMIT 1)`,
        );
        await queryRunner.query(`ALTER TABLE "games" ADD CONSTRAINT "FK_1a9ce5f2b43dfd0c1db044abfb2" FOREIGN KEY ("created_by") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "games" DROP CONSTRAINT "FK_1a9ce5f2b43dfd0c1db044abfb2"`);
        await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "cover_file"`);
        await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "created_by"`);
    }

}
