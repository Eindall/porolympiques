import { MigrationInterface, QueryRunner } from "typeorm";

export class SeasonsEventsCatalog1794594331257 implements MigrationInterface {
    name = 'SeasonsEventsCatalog1794594331257'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "catalog_search_cache" ("query" character varying(200) NOT NULL, "results" jsonb NOT NULL, "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_ceda978880fbe68e30cb0a0439e" PRIMARY KEY ("query"))`);
        await queryRunner.query(`CREATE TABLE "games" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "source" character varying(16) NOT NULL, "external_id" character varying(64), "name" character varying(200) NOT NULL, "cover_url" character varying(512), "price_tier" character varying(16), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "games_external_id_check" CHECK (("source" = 'custom') = ("external_id" IS NULL)), CONSTRAINT "games_price_tier_check" CHECK ("price_tier" IN ('free', 'lt10', '10to30', 'gt30')), CONSTRAINT "games_source_check" CHECK ("source" IN ('igdb', 'custom')), CONSTRAINT "PK_c9b16b62917b5595af982d66337" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "games_source_external_id" ON "games"  ("source", "external_id") WHERE "external_id" IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "formats" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "game_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "description" text NOT NULL DEFAULT '', "team_mode" character varying(16) NOT NULL, "play_mode" character varying(16) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'proposed', "suggested_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "formats_status_check" CHECK ("status" IN ('proposed', 'selected')), CONSTRAINT "formats_play_mode_check" CHECK ("play_mode" IN ('async', 'live')), CONSTRAINT "formats_team_mode_check" CHECK ("team_mode" IN ('solo', 'team')), CONSTRAINT "PK_e99e1793fec9a30a4b463b46869" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_97a664a4fa5ec4aa61c8cbb86a" ON "formats"  ("game_id") `);
        await queryRunner.query(`CREATE TABLE "votes" ("player_id" uuid NOT NULL, "format_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d91cdb896fad91acb047ce1c141" PRIMARY KEY ("player_id", "format_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_91c7751853ae2050ddfe95ebb2" ON "votes"  ("format_id") `);
        await queryRunner.query(`CREATE TABLE "seasons" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(100) NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL, "end_date" TIMESTAMP WITH TIME ZONE NOT NULL, "scoring_scale" jsonb NOT NULL, "main_quota" smallint NOT NULL DEFAULT '3', "side_quota" smallint NOT NULL DEFAULT '2', "status" character varying(16) NOT NULL DEFAULT 'upcoming', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "seasons_dates_check" CHECK ("end_date" > "start_date"), CONSTRAINT "seasons_quotas_check" CHECK ("main_quota" >= 0 AND "side_quota" >= 0), CONSTRAINT "seasons_status_check" CHECK ("status" IN ('upcoming', 'active', 'finished')), CONSTRAINT "PK_cb8ed53b5fe109dcd4a4449ec9d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "seasons_single_active" ON "seasons"  ("status") WHERE "status" = 'active'`);
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "season_id" uuid NOT NULL, "format_id" uuid NOT NULL, "type" character varying(16) NOT NULL, "coefficient" numeric(4,2) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'announced', "rules" text NOT NULL DEFAULT '', "announce_date" TIMESTAMP WITH TIME ZONE NOT NULL, "registration_end" TIMESTAMP WITH TIME ZONE NOT NULL, "end_date" TIMESTAMP WITH TIME ZONE NOT NULL, "live_date" TIMESTAMP WITH TIME ZONE, "host_id" uuid, "challonge_url" character varying(512), "validated" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "events_coefficient_check" CHECK ("coefficient" > 0), CONSTRAINT "events_status_check" CHECK ("status" IN ('announced', 'registration', 'in_progress', 'finished', 'cancelled')), CONSTRAINT "events_type_check" CHECK ("type" IN ('main', 'side')), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fb98daef5570cb124e34c9ea42" ON "events"  ("format_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_015b33819d8f4e702bafb77b79" ON "events"  ("season_id") `);
        await queryRunner.query(`CREATE TABLE "teams" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "event_id" uuid NOT NULL, "name" character varying(100) NOT NULL, CONSTRAINT "teams_event_name" UNIQUE ("event_id", "name"), CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "registrations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "event_id" uuid NOT NULL, "player_id" uuid NOT NULL, "team_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "registrations_event_player" UNIQUE ("event_id", "player_id"), CONSTRAINT "PK_6013e724d7b22929da9cd7282d1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3ad0ac552ccc62c2d5321d8ad0" ON "registrations"  ("player_id") `);
        await queryRunner.query(`CREATE TABLE "results" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "event_id" uuid NOT NULL, "player_id" uuid NOT NULL, "place" smallint, CONSTRAINT "results_event_player" UNIQUE ("event_id", "player_id"), CONSTRAINT "results_place_check" CHECK ("place" >= 1), CONSTRAINT "PK_e8f2a9191c61c15b627c117a678" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_67b4ea958161def5aceca1df9f" ON "results"  ("player_id") `);
        await queryRunner.query(`CREATE TABLE "suggestions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "author_id" uuid NOT NULL, "title" character varying(150) NOT NULL, "description" text NOT NULL DEFAULT '', "category" character varying(16) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'proposed', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "suggestions_status_check" CHECK ("status" IN ('proposed', 'planned', 'done')), CONSTRAINT "suggestions_category_check" CHECK ("category" IN ('format', 'site', 'bot', 'process')), CONSTRAINT "PK_745bbcb037ac379969b5fc7b352" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_905e2619eb9dd68158b11390de" ON "suggestions"  ("author_id") `);
        await queryRunner.query(`CREATE TABLE "suggestion_votes" ("suggestion_id" uuid NOT NULL, "player_id" uuid NOT NULL, "value" smallint NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "suggestion_votes_value_check" CHECK ("value" IN (1, -1)), CONSTRAINT "PK_0bbeb87da1d40dfb6d2c53c0a28" PRIMARY KEY ("suggestion_id", "player_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0d768d210fbc206e3c947d2449" ON "suggestion_votes"  ("player_id") `);
        await queryRunner.query(`ALTER TABLE "formats" ADD CONSTRAINT "FK_97a664a4fa5ec4aa61c8cbb86af" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "formats" ADD CONSTRAINT "FK_a980d85df1e48a1681a6096031f" FOREIGN KEY ("suggested_by") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_330031e43d1716143fdbaf1c36f" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_91c7751853ae2050ddfe95ebb28" FOREIGN KEY ("format_id") REFERENCES "formats"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_015b33819d8f4e702bafb77b796" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_fb98daef5570cb124e34c9ea42c" FOREIGN KEY ("format_id") REFERENCES "formats"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_a612b523901cc5dd938ff3bdb03" FOREIGN KEY ("host_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_26d243fdc44c2b67e541b796a81" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD CONSTRAINT "FK_c082d66f7080c743a96c1e91807" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD CONSTRAINT "FK_3ad0ac552ccc62c2d5321d8ad0e" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD CONSTRAINT "FK_7b6436e8a7283fcb9d606ed4bb4" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "results" ADD CONSTRAINT "FK_1d5dc8f6abf1b3ce3c044dfb7c6" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "results" ADD CONSTRAINT "FK_67b4ea958161def5aceca1df9f1" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suggestions" ADD CONSTRAINT "FK_905e2619eb9dd68158b11390de4" FOREIGN KEY ("author_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suggestion_votes" ADD CONSTRAINT "FK_1308f9c6d4fae2c9c5212e6023f" FOREIGN KEY ("suggestion_id") REFERENCES "suggestions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suggestion_votes" ADD CONSTRAINT "FK_0d768d210fbc206e3c947d2449f" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "suggestion_votes" DROP CONSTRAINT "FK_0d768d210fbc206e3c947d2449f"`);
        await queryRunner.query(`ALTER TABLE "suggestion_votes" DROP CONSTRAINT "FK_1308f9c6d4fae2c9c5212e6023f"`);
        await queryRunner.query(`ALTER TABLE "suggestions" DROP CONSTRAINT "FK_905e2619eb9dd68158b11390de4"`);
        await queryRunner.query(`ALTER TABLE "results" DROP CONSTRAINT "FK_67b4ea958161def5aceca1df9f1"`);
        await queryRunner.query(`ALTER TABLE "results" DROP CONSTRAINT "FK_1d5dc8f6abf1b3ce3c044dfb7c6"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP CONSTRAINT "FK_7b6436e8a7283fcb9d606ed4bb4"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP CONSTRAINT "FK_3ad0ac552ccc62c2d5321d8ad0e"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP CONSTRAINT "FK_c082d66f7080c743a96c1e91807"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_26d243fdc44c2b67e541b796a81"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_a612b523901cc5dd938ff3bdb03"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_fb98daef5570cb124e34c9ea42c"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_015b33819d8f4e702bafb77b796"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_91c7751853ae2050ddfe95ebb28"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_330031e43d1716143fdbaf1c36f"`);
        await queryRunner.query(`ALTER TABLE "formats" DROP CONSTRAINT "FK_a980d85df1e48a1681a6096031f"`);
        await queryRunner.query(`ALTER TABLE "formats" DROP CONSTRAINT "FK_97a664a4fa5ec4aa61c8cbb86af"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0d768d210fbc206e3c947d2449"`);
        await queryRunner.query(`DROP TABLE "suggestion_votes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_905e2619eb9dd68158b11390de"`);
        await queryRunner.query(`DROP TABLE "suggestions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_67b4ea958161def5aceca1df9f"`);
        await queryRunner.query(`DROP TABLE "results"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3ad0ac552ccc62c2d5321d8ad0"`);
        await queryRunner.query(`DROP TABLE "registrations"`);
        await queryRunner.query(`DROP TABLE "teams"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_015b33819d8f4e702bafb77b79"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fb98daef5570cb124e34c9ea42"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP INDEX "public"."seasons_single_active"`);
        await queryRunner.query(`DROP TABLE "seasons"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_91c7751853ae2050ddfe95ebb2"`);
        await queryRunner.query(`DROP TABLE "votes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97a664a4fa5ec4aa61c8cbb86a"`);
        await queryRunner.query(`DROP TABLE "formats"`);
        await queryRunner.query(`DROP INDEX "public"."games_source_external_id"`);
        await queryRunner.query(`DROP TABLE "games"`);
        await queryRunner.query(`DROP TABLE "catalog_search_cache"`);
    }

}
