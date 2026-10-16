import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../users/entities/user.entity';

/** Seeds one admin and one normal user (activated). Existing emails are skipped. */
export async function seedUsers(manager: EntityManager, config: ConfigService) {
  const accounts = [
    {
      email: config.get<string>('SEED_ADMIN_EMAIL') || 'admin@hotel.local',
      password: config.get<string>('SEED_ADMIN_PASSWORD') || 'Admin@123',
      fullName: 'Administrator',
      role: UserRole.ADMIN,
    },
    {
      email: 'user@hotel.local',
      password: 'User@123',
      fullName: 'Demo User',
      role: UserRole.USER,
    },
  ];

  const repo = manager.getRepository(User);
  let created = 0;
  for (const account of accounts) {
    if (await repo.existsBy({ email: account.email })) continue;
    await repo.insert({
      ...account,
      password: await bcrypt.hash(account.password, 10),
      phone: '0912345678',
      activatedAt: () => 'now()',
    });
    created++;
  }
  return created;
}
