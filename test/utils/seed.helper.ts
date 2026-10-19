import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../../src/users/entities/user.entity';

export interface SeededUser {
  id: string;
  token: string;
  email: string;
  password: string;
  fullName: string;
}

const DEFAULT_PASSWORD = 'password123';

/** Registers, activates (bypassing the email link) and logs in a user. */
export async function createUser(
  app: INestApplication,
  overrides: Partial<{
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
  }> = {},
): Promise<SeededUser> {
  const email = overrides.email ?? `user_${Date.now()}@example.com`;
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const fullName = overrides.fullName ?? 'Test User';

  await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password, fullName, phone: '0912345678' })
    .expect(201);

  await app
    .get(DataSource)
    .getRepository(User)
    .update(
      { email },
      { activatedAt: () => 'now()', role: overrides.role ?? UserRole.USER },
    );

  const loginRes = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    id: loginRes.body.user.id,
    token: loginRes.body.user.token,
    email,
    password,
    fullName,
  };
}
