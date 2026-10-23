import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app.factory';
import { truncateDatabase } from './utils/database.helper';
import { createUser, SeededUser } from './utils/seed.helper';
import { UPLOAD_DIR } from '../src/attachments/multer.config';
import { Attachment } from '../src/attachments/entities/attachment.entity';

const PNG = { filename: 'avatar.png', contentType: 'image/png' };
const smallImage = Buffer.from('fake-png-bytes');
const listUploads = () =>
  readdirSync(UPLOAD_DIR).filter((f) => !f.startsWith('.'));

describe('Me / profile (e2e)', () => {
  let app: INestApplication;
  let user: SeededUser;
  let uploadsBefore: Set<string>;

  const api = () => request(app.getHttpServer());
  const authed = (req: request.Test) =>
    req.set('Authorization', `Bearer ${user.token}`);
  const patchMe = () => authed(api().patch('/api/me'));
  /** Files written to the upload dir by this suite. */
  const newUploads = () => listUploads().filter((f) => !uploadsBefore.has(f));

  beforeAll(async () => {
    app = await createTestApp();
    uploadsBefore = new Set(listUploads());
  });

  beforeEach(async () => {
    await truncateDatabase(app);
    user = await createUser(app, {
      email: 'me@example.com',
      fullName: 'Old Name',
    });
  });

  afterAll(async () => {
    newUploads().forEach((f) => unlinkSync(join(UPLOAD_DIR, f)));
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
      const firstFile = basename(first.body.avatar);
      expect(first.body.avatar).toMatch(/\/uploads\/.+\.png$/);
      expect(existsSync(join(UPLOAD_DIR, firstFile))).toBe(true);

      const second = await patchMe()
        .attach('avatar', smallImage, PNG)
        .expect(200);
      const secondFile = basename(second.body.avatar);
      expect(secondFile).not.toBe(firstFile);
      expect(existsSync(join(UPLOAD_DIR, firstFile))).toBe(false);
      expect(existsSync(join(UPLOAD_DIR, secondFile))).toBe(true);

      const rows = await app.get(DataSource).getRepository(Attachment).countBy({
        entityType: 'user',
        entityId: user.id,
      });
      expect(rows).toBe(1);
    });

    it('deletes the uploaded file when validation fails', async () => {
      const before = newUploads().length;
      await patchMe()
        .field('phone', 'not-a-phone')
        .attach('avatar', smallImage, PNG)
        .expect(400);
      // cleanup is async (best effort) — give it a moment
      await new Promise((r) => setTimeout(r, 100));
      expect(newUploads()).toHaveLength(before);
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
