import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotelEntities1792051036216 implements MigrationInterface {
  name = 'AddHotelEntities1792051036216';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "room_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "description" text, CONSTRAINT "UQ_20180102ff8f034e54c5812f695" UNIQUE ("name"), CONSTRAINT "PK_b6e1d0a9b67d4b9fbff9c35ab69" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "room_images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "url" character varying(255) NOT NULL, "room_id" uuid NOT NULL, CONSTRAINT "PK_ac049009c777706919d50237ecf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5f4e74488214bfa1d5b6556ddd" ON "room_images"  ("room_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "amenities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, CONSTRAINT "UQ_8c5f9c7ff7e2174b53d4be10247" UNIQUE ("name"), CONSTRAINT "PK_c0777308847b3556086f2fb233e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "price_per_night" numeric(12,2) NOT NULL, "capacity" integer NOT NULL, "bed_type" character varying(20) NOT NULL, "view" character varying(20) NOT NULL, "description" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "room_type_id" uuid NOT NULL, CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8a380bdc519b8701daf0ec62da" ON "rooms"  ("room_type_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rating" integer NOT NULL, "comment" text, "status" character varying(20) NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "booking_id" uuid NOT NULL, "moderated_by" uuid, CONSTRAINT "REL_bbd6ac6e3e6a8f8c6e0e8692d6" UNIQUE ("booking_id"), CONSTRAINT "CHK_reviews_rating" CHECK ("rating" BETWEEN 1 AND 5), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "check_in" date NOT NULL, "check_out" date NOT NULL, "total_price" numeric(12,2) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "note" text, "reject_reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "room_id" uuid NOT NULL, CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_48b267d894e32a25ebde4b207a" ON "bookings"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_64cd97487c5c42806458ab5520" ON "bookings"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5ad78cbd837f006dec91f3612e" ON "bookings"  ("room_id", "check_in", "check_out") `,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "amount" numeric(12,2) NOT NULL, "method" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "paid_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "booking_id" uuid NOT NULL, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e86edf76dc2424f123b9023a2b" ON "payments"  ("booking_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "room_amenities" ("room_id" uuid NOT NULL, "amenity_id" uuid NOT NULL, CONSTRAINT "PK_6873eccbd044cfef35305a21671" PRIMARY KEY ("room_id", "amenity_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1bbdd33b01f2e52f4dd5074354" ON "room_amenities"  ("room_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_936612d991e2522e82cd86fa10" ON "room_amenities"  ("amenity_id") `,
    );
    // Hand-edited: TypeORM generates DROP + ADD for renamed/resized columns, which loses data
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "fullName" TO "full_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "isActive" TO "is_active"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "activatedAt" TO "activated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "image" TO "avatar"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "avatar" DROP NOT NULL, ALTER COLUMN "avatar" DROP DEFAULT`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "avatar" = NULL WHERE "avatar" = ''`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" character varying(20) NOT NULL DEFAULT 'user'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" TYPE character varying(255), ALTER COLUMN "password" TYPE character varying(255), ALTER COLUMN "full_name" TYPE character varying(100), ALTER COLUMN "phone" TYPE character varying(20), ALTER COLUMN "avatar" TYPE character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_images" ADD CONSTRAINT "FK_5f4e74488214bfa1d5b6556ddd6" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rooms" ADD CONSTRAINT "FK_8a380bdc519b8701daf0ec62da0" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_bbd6ac6e3e6a8f8c6e0e8692d63" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_aa0cc85bea595654ce1ebfd24c3" FOREIGN KEY ("moderated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_64cd97487c5c42806458ab5520c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_0b0fc32fe6bd0119e281628df7a" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_e86edf76dc2424f123b9023a2b2" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_amenities" ADD CONSTRAINT "FK_1bbdd33b01f2e52f4dd50743544" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_amenities" ADD CONSTRAINT "FK_936612d991e2522e82cd86fa106" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_amenities" DROP CONSTRAINT "FK_936612d991e2522e82cd86fa106"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_amenities" DROP CONSTRAINT "FK_1bbdd33b01f2e52f4dd50743544"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_e86edf76dc2424f123b9023a2b2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_0b0fc32fe6bd0119e281628df7a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_64cd97487c5c42806458ab5520c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_aa0cc85bea595654ce1ebfd24c3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_bbd6ac6e3e6a8f8c6e0e8692d63"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rooms" DROP CONSTRAINT "FK_8a380bdc519b8701daf0ec62da0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_images" DROP CONSTRAINT "FK_5f4e74488214bfa1d5b6556ddd6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" TYPE character varying, ALTER COLUMN "password" TYPE character varying, ALTER COLUMN "full_name" TYPE character varying, ALTER COLUMN "phone" TYPE character varying, ALTER COLUMN "avatar" TYPE character varying`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "bio" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "avatar" = '' WHERE "avatar" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "avatar" SET DEFAULT '', ALTER COLUMN "avatar" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "avatar" TO "image"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "updated_at" TO "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "created_at" TO "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "activated_at" TO "activatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "is_active" TO "isActive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "full_name" TO "fullName"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_936612d991e2522e82cd86fa10"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1bbdd33b01f2e52f4dd5074354"`,
    );
    await queryRunner.query(`DROP TABLE "room_amenities"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e86edf76dc2424f123b9023a2b"`,
    );
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5ad78cbd837f006dec91f3612e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_64cd97487c5c42806458ab5520"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_48b267d894e32a25ebde4b207a"`,
    );
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8a380bdc519b8701daf0ec62da"`,
    );
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TABLE "amenities"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5f4e74488214bfa1d5b6556ddd"`,
    );
    await queryRunner.query(`DROP TABLE "room_images"`);
    await queryRunner.query(`DROP TABLE "room_types"`);
  }
}
