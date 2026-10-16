import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { seedUsers } from './users.seeder';
import { seedRooms } from './rooms.seeder';

/**
 * Console seeder: `npm run seed`. Boots the Nest app context (no HTTP server)
 * to reuse the configured DataSource, then seeds everything in one transaction.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    // Hide Nest bootstrap logs; the seeder prints its own summary
    logger: ['error', 'warn'],
  });

  try {
    const config = app.get(ConfigService);
    await app.get(DataSource).transaction(async (manager) => {
      console.log(`Users created: ${await seedUsers(manager, config)}`);
      console.log(`Rooms created: ${await seedRooms(manager)}`);
    });
    console.log('Seeding completed');
  } catch (error) {
    console.error('Seeding failed', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap().then(() => process.exit());
