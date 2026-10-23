import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app.factory';
import { truncateDatabase } from './utils/database.helper';
import { createUser, SeededUser } from './utils/seed.helper';
import { UserRole } from '../src/users/entities/user.entity';

describe('Admin users (e2e)', () => {
  let app: INestApplication;
  let admin: SeededUser;
  let user: SeededUser;

  const api = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${admin.token}`);

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateDatabase(app);
    admin = await createUser(app, {
      email: 'admin@example.com',
      fullName: 'Admin',
      role: UserRole.ADMIN,
    });
    user = await createUser(app, {
      email: 'alice@example.com',
      fullName: 'Alice Nguyen',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authorization (RolesGuard)', () => {
    it('returns 401 without a token', async () => {
      await api().get('/api/admin/users').expect(401);
    });

    it('returns 403 for a normal user', async () => {
      await api()
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/users', () => {
    it('lists users with pagination meta and no passwords', async () => {
      const res = await asAdmin(api().get('/api/admin/users')).expect(200);

      expect(res.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
      expect(res.body.data[0].password).toBeUndefined();
    });

    it('filters by keyword (case-insensitive), role and isActive', async () => {
      const byKeyword = await asAdmin(
        api().get('/api/admin/users').query({ keyword: 'ALICE' }),
      ).expect(200);
      expect(byKeyword.body.data.map((u: any) => u.email)).toEqual([
        user.email,
      ]);

      const byRole = await asAdmin(
        api().get('/api/admin/users').query({ role: 'admin' }),
      ).expect(200);
      expect(byRole.body.data.map((u: any) => u.email)).toEqual([admin.email]);

      const inactive = await asAdmin(
        api().get('/api/admin/users').query({ isActive: 'false' }),
      ).expect(200);
      expect(inactive.body.meta.total).toBe(0);
    });

    it('treats % in keyword literally', async () => {
      const res = await asAdmin(
        api().get('/api/admin/users').query({ keyword: '%' }),
      ).expect(200);
      expect(res.body.meta.total).toBe(0);
    });

    it('paginates', async () => {
      const res = await asAdmin(
        api().get('/api/admin/users').query({ page: 2, limit: 1 }),
      ).expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ page: 2, totalPages: 2 });
    });

    it.each([
      { page: 0 },
      { limit: 101 },
      { role: 'superadmin' },
      { isActive: 'yes' },
    ])('returns 400 for invalid query %o', async (query) => {
      await asAdmin(api().get('/api/admin/users').query(query)).expect(400);
    });
  });

  describe('GET /api/admin/users/:id', () => {
    it('returns the user', async () => {
      const res = await asAdmin(
        api().get(`/api/admin/users/${user.id}`),
      ).expect(200);
      expect(res.body).toMatchObject({ id: user.id, email: user.email });
      expect(res.body.password).toBeUndefined();
    });

    it('returns 404 for an unknown id and 400 for a non-uuid', async () => {
      await asAdmin(
        api().get('/api/admin/users/00000000-0000-4000-8000-000000000000'),
      ).expect(404);
      await asAdmin(api().get('/api/admin/users/abc')).expect(400);
    });
  });

  describe('PATCH /api/admin/users/:id/status', () => {
    it('locks a user: login and existing token are rejected', async () => {
      const res = await asAdmin(
        api()
          .patch(`/api/admin/users/${user.id}/status`)
          .send({ isActive: false }),
      ).expect(200);
      expect(res.body.isActive).toBe(false);

      await api()
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(403);
      await api()
        .get('/api/me')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(401);
    });

    it('unlocks a user', async () => {
      const path = `/api/admin/users/${user.id}/status`;
      await asAdmin(api().patch(path).send({ isActive: false })).expect(200);
      await asAdmin(api().patch(path).send({ isActive: true })).expect(200);

      await api()
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);
    });

    it('prevents an admin from locking themselves', async () => {
      await asAdmin(
        api()
          .patch(`/api/admin/users/${admin.id}/status`)
          .send({ isActive: false }),
      ).expect(400);
    });

    it('validates the body', async () => {
      await asAdmin(
        api()
          .patch(`/api/admin/users/${user.id}/status`)
          .send({ isActive: 'no' }),
      ).expect(400);
    });
  });
});
