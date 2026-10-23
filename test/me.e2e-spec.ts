import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app.factory';
import { truncateDatabase } from './utils/database.helper';
import { createUser, SeededUser } from './utils/seed.helper';
import {
  PNG,
  smallImage,
  trackUploads,
  uploadExists,
  waitForCleanup,
} from './utils/uploads.helper';
import { Attachment } from '../src/attachments/entities/attachment.entity';

describe('Me / profile (e2e)', () => {
  let app: INestApplication;
  let user: SeededUser;
  let uploads: ReturnType<typeof trackUploads>;

  const api = () => request(app.getHttpServer());
  const authed = (req: request.Test) =>
    req.set('Authorization', `Bearer ${user.token}`);
  const patchMe = () => authed(api().patch('/api/me'));

  beforeAll(async () => {
    app = await createTestApp();
    uploads = trackUploads();
  });

  beforeEach(async () => {
    await truncateDatabase(app);
    user = await createUser(app, {
      email: 'me@example.com',
      fullName: 'Old Name',
    });
  });

  afterAll(async () => {
    uploads.cleanup();
    await app.close();
  });

  describe('GET /api/me', () => {
    it('returns the current user without password', async () => {
      const res = await authed(api().get('/api/me')).expect(200);
      expect(res.body).toMatchObject({
        id: user.id,
        email: user.email,
        fullName: 'Old Name',
      });
      expect(res.body.password).toBeUndefined();
    });

    it('requires login, and the old tutorial route is gone', async () => {
      await api().get('/api/me').expect(401);
      await authed(api().get('/api/user')).expect(404);
    });
  });

  describe('PATCH /api/me', () => {
    it('updates fullName and phone (trimmed)', async () => {
      const res = await patchMe()
        .field('fullName', '  New Name  ')
        .field('phone', '0987654321')
        .expect(200);
      expect(res.body).toMatchObject({
        fullName: 'New Name',
        phone: '0987654321',
      });
      expect(res.body.password).toBeUndefined();
    });

    it('uploads an avatar and replaces (deletes) the previous file', async () => {
      const first = await patchMe()
        .attach('avatar', smallImage, PNG)
        .expect(200);
      expect(first.body.avatar).toMatch(/\/uploads\/.+\.png$/);
      expect(uploadExists(first.body.avatar)).toBe(true);

      const second = await patchMe()
        .attach('avatar', smallImage, PNG)
        .expect(200);
      expect(second.body.avatar).not.toBe(first.body.avatar);
      expect(uploadExists(first.body.avatar)).toBe(false);
      expect(uploadExists(second.body.avatar)).toBe(true);

      const rows = await app.get(DataSource).getRepository(Attachment).countBy({
        entityType: 'user',
        entityId: user.id,
      });
      expect(rows).toBe(1);
    });

    it('deletes the uploaded file when validation fails', async () => {
      const before = uploads.newFiles().length;
      await patchMe()
        .field('phone', 'not-a-phone')
        .attach('avatar', smallImage, PNG)
        .expect(400);
      await waitForCleanup();
      expect(uploads.newFiles()).toHaveLength(before);
    });

    it('rejects non-image files (400) and files over 2MB (413)', async () => {
      await patchMe()
        .attach('avatar', Buffer.from('hello'), {
          filename: 'a.txt',
          contentType: 'text/plain',
        })
        .expect(400);
      await patchMe()
        .attach('avatar', Buffer.alloc(2 * 1024 * 1024 + 1), PNG)
        .expect(413);
    });

    it.each([
      ['email is not editable here', { email: 'x@example.com' }],
      ['blank fullName', { fullName: '   ' }],
      ['password is not editable here', { password: 'newpass123' }],
    ])('returns 400 when %s', async (_: string, body: object) => {
      await patchMe().send(body).expect(400);
    });
  });

  describe('PATCH /api/me/password', () => {
    const changePassword = (body: object) =>
      authed(api().patch('/api/me/password')).send(body);
    const login = (password: string) =>
      api().post('/api/auth/login').send({ email: user.email, password });

    it('changes the password: new one works, old one does not', async () => {
      await changePassword({
        currentPassword: user.password,
        newPassword: 'brandNew123',
      }).expect(200);

      await login('brandNew123').expect(200);
      await login(user.password).expect(401);
    });

    it.each([
      [
        'wrong current password',
        { currentPassword: 'wrong-pass', newPassword: 'brandNew123' },
      ],
      [
        'new = current',
        { currentPassword: 'password123', newPassword: 'password123' },
      ],
      ['new too short', { currentPassword: 'password123', newPassword: '123' }],
      ['missing current', { newPassword: 'brandNew123' }],
    ])('returns 400 for %s', async (_: string, body: object) => {
      await changePassword(body).expect(400);
      await login(user.password).expect(200);
    });
  });
});
