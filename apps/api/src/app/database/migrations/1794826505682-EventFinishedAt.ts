import { MigrationInterface, QueryRunner } from "typeorm";

export class EventFinishedAt1794826505682 implements MigrationInterface {
    name = 'EventFinishedAt1794826505682'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" ADD "finished_at" TIMESTAMP WITH TIME ZONE`);
        // Events déjà terminés : on prend leur date de fin comme date de clôture.
        await queryRunner.query(`UPDATE "events" SET "finished_at" = "end_date" WHERE "status" = 'finished'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "finished_at"`);
    }

}
