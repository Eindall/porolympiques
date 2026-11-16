import { MigrationInterface, QueryRunner } from "typeorm";

export class EventMessages1794844692285 implements MigrationInterface {
    name = 'EventMessages1794844692285'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" ADD "announcement_message_id" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "events" ADD "results_message_id" character varying(32)`);
        // Events créés avant le bot : marqués « sans message » (SILENT_MESSAGE_ID du domaine), pour ne pas
        // déclencher d'annonce ni de résultats (avec @everyone) au premier démarrage.
        await queryRunner.query(`UPDATE "events" SET "announcement_message_id" = '-', "results_message_id" = '-'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "results_message_id"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "announcement_message_id"`);
    }

}
