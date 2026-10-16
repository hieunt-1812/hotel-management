import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app.factory';
import { truncateDatabase } from './utils/database.helper';
import { seedUsers } from '../src/database/seeds/users.seeder';
import { seedRooms } from '../src/database/seeds/rooms.seeder';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Room } from '../src/rooms/entities/room.entity';

describe('Seeder (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  const runSeed = () =>
    ds.transaction(async (manager) => ({
      users: await seedUsers(manager, app.get(ConfigService)),
      rooms: await seedRooms(manager),
    }));

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    await truncateDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('seeds an activated admin and rooms with type and amenities', async () => {
    expect(await runSeed()).toEqual({ users: 2, rooms: 5 });

    const admin = await ds
      .getRepository(User)
      .findOneByOrFail({ role: UserRole.ADMIN });
    expect(admin.activatedAt).toBeInstanceOf(Date);

    const room = await ds.getRepository(Room).findOneOrFail({
      where: { name: 'Room 301' },
      relations: { roomType: true, amenities: true },
    });
    expect(room.roomType.name).toBe('Suite');
    expect(room.amenities.length).toBeGreaterThan(0);
  });

  it('is idempotent', async () => {
    expect(await runSeed()).toEqual({ users: 0, rooms: 0 });
  });
});
