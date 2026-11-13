import { MigrationInterface, QueryRunner } from "typeorm";

export class Players1794566338671 implements MigrationInterface {
    name = 'Players1794566338671'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "players" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "discord_id" character varying(32) NOT NULL, "pseudo" character varying(100) NOT NULL, "avatar_url" character varying(512) NOT NULL, "role" character varying(16) NOT NULL DEFAULT 'player', "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a35da443d0b2d47b6731fd79b99" UNIQUE ("discord_id"), CONSTRAINT "players_role_check" CHECK ("role" IN ('admin', 'player')), CONSTRAINT "PK_de22b8fdeee0c33ab55ae71da3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "auth_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "player_id" uuid NOT NULL, "user_agent" character varying(256), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_641507381f32580e8479efc36cd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a4a11809dcf8cdd5fcceec774e" ON "auth_sessions"  ("expires_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_170658891fe0d90ef2054ec10f" ON "auth_sessions"  ("player_id") `);
        await queryRunner.query(`ALTER TABLE "auth_sessions" ADD CONSTRAINT "FK_170658891fe0d90ef2054ec10fe" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_170658891fe0d90ef2054ec10fe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_170658891fe0d90ef2054ec10f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4a11809dcf8cdd5fcceec774e"`);
        await queryRunner.query(`DROP TABLE "auth_sessions"`);
        await queryRunner.query(`DROP TABLE "players"`);
    }

}
