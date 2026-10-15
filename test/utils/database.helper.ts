import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

export async function truncateDatabase(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const tableNames = dataSource.entityMetadatas
    .map((entity) => `"${entity.tableName}"`)
    .join(', ');

  if (!tableNames) return;

  await dataSource.query(
    `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`,
  );
}
