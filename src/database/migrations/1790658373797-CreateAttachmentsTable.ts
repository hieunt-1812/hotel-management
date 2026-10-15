import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttachmentsTable1790658373797
  implements MigrationInterface
{
  name = 'CreateAttachmentsTable1790658373797';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entityType" character varying NOT NULL, "entityId" uuid NOT NULL, "url" character varying NOT NULL, "fileName" character varying NOT NULL, "fileType" character varying NOT NULL, "fileSize" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_attachments_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attachment_owner" ON "attachments" ("entityType", "entityId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_attachment_owner"`);
    await queryRunner.query(`DROP TABLE "attachments"`);
  }
}
