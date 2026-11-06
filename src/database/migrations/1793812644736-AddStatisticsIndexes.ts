import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatisticsIndexes1793812644736 implements MigrationInterface {
  name = 'AddStatisticsIndexes1793812644736';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_1e4447ccf2f39b5d0a7baf1cce" ON "payments"  ("status", "paid_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3411322e212076d1ac1a71e6ed" ON "bookings"  ("created_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3411322e212076d1ac1a71e6ed"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1e4447ccf2f39b5d0a7baf1cce"`,
    );
  }
}
