import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app.factory';
import { truncateDatabase } from './utils/database.helper';
import { createUser } from './utils/seed.helper';
import { MailService } from '../src/mail/mail.service';
import { User } from '../src/users/entities/user.entity';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let sendActivationMail: jest.SpyInstance;

  const registerBody = {
    email: 'guest@example.com',
    password: 'password123',
    fullName: 'Nguyen Van A',
    phone: '0912345678',
  };

  const register = (body: object = registerBody) =>
    request(app.getHttpServer()).post('/api/auth/register').send(body);

  const login = (
    email = registerBody.email,
    password = registerBody.password,
  ) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });

  /** Token from the URL of the most recently queued activation mail. */
  const lastActivationToken = () => {
    const { activationUrl } = sendActivationMail.mock.lastCall[0];
    return new URL(activationUrl).searchParams.get('token') as string;
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateDatabase(app);
    sendActivationMail = jest
      .spyOn(app.get(MailService), 'sendActivationMail')
      .mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('creates an inactive user without exposing the password and queues the activation mail', async () => {
      const res = await register().expect(201);

      expect(res.body.user).toMatchObject({
        email: registerBody.email,
        fullName: registerBody.fullName,
        phone: registerBody.phone,
        activatedAt: null,
      });
      expect(res.body.user.password).toBeUndefined();
      expect(sendActivationMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: registerBody.email,
          activationUrl: expect.stringContaining('/api/auth/activate?token='),
        }),
      );
    });

    it('returns 409 for a duplicate email', async () => {
      await register().expect(201);
      await register().expect(409);
    });

    it.each([
      ['invalid email', { email: 'not-an-email' }],
      ['short password', { password: '123' }],
      ['missing fullName', { fullName: '' }],
      ['invalid phone', { phone: 'abc' }],
      ['unknown field', { username: 'johndoe' }],
    ])('returns 400 for %s', async (_, override) => {
      await register({ ...registerBody, ...override }).expect(400);
    });
  });

  describe('GET /api/auth/activate', () => {
    it('activates the account once; the token cannot be reused', async () => {
      await register().expect(201);
      const token = lastActivationToken();

      await request(app.getHttpServer())
        .get('/api/auth/activate')
        .query({ token })
        .expect(200);

      const user = await app
        .get(DataSource)
        .getRepository(User)
        .findOneByOrFail({ email: registerBody.email });
      expect(user.activatedAt).toBeInstanceOf(Date);

      await request(app.getHttpServer())
        .get('/api/auth/activate')
        .query({ token })
        .expect(400);
    });

    it('returns 400 for an invalid or missing token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/activate')
        .query({ token: 'invalid' })
        .expect(400);
      await request(app.getHttpServer()).get('/api/auth/activate').expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects a not-yet-activated account with 403', async () => {
      await register().expect(201);
      await login().expect(403);
    });

    it('logs in after activation and returns a token', async () => {
      await register().expect(201);
      await request(app.getHttpServer())
        .get('/api/auth/activate')
        .query({ token: lastActivationToken() })
        .expect(200);

      const res = await login().expect(200);
      expect(res.body.user.token).toEqual(expect.any(String));
      expect(res.body.user.password).toBeUndefined();
    });

    it('rejects a locked account with 403', async () => {
      const { email, password } = await createUser(app);
      await app
        .get(DataSource)
        .getRepository(User)
        .update({ email }, { isActive: false });

      await login(email, password).expect(403);
    });

    it('returns 401 for a wrong password', async () => {
      const { email } = await createUser(app);
      await login(email, 'wrong-password').expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('blacklists the token', async () => {
      const { token } = await createUser(app);
      const server = app.getHttpServer();

      await request(server)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(server)
        .get('/api/user')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });
});
