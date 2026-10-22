import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app.factory';
import { truncateDatabase } from './utils/database.helper';
import { createUser, SeededUser } from './utils/seed.helper';
import {
  createBooking,
  dayFromToday,
  seedRoomCatalog,
} from './utils/room-fixtures.helper';
import {
  Booking,
  BookingStatus,
} from '../src/bookings/entities/booking.entity';
import { User, UserRole } from '../src/users/entities/user.entity';
import { MailService } from '../src/mail/mail.service';

describe('Admin bookings (e2e)', () => {
  let app: INestApplication;
  let catalog: Awaited<ReturnType<typeof seedRoomCatalog>>;
  let admin: SeededUser;
  let alice: SeededUser;
  let sendMail: jest.SpyInstance;

  const api = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${admin.token}`);
  const uuid0 = '00000000-0000-4000-8000-000000000000';

  /** Booking for alice on the "Mid" room (or another room) via the repository. */
  const insertBooking = async (
    status = BookingStatus.PENDING,
    room = catalog.mid,
    from = 10,
  ) =>
    createBooking(catalog.ds, {
      room,
      user: await catalog.ds
        .getRepository(User)
        .findOneByOrFail({ id: alice.id }),
      checkIn: dayFromToday(from),
      checkOut: dayFromToday(from + 2),
      status,
    });

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateDatabase(app);
    catalog = await seedRoomCatalog(app);
    admin = await createUser(app, {
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    });
    alice = await createUser(app, {
      email: 'alice@example.com',
      fullName: 'Alice',
    });
    sendMail = jest
      .spyOn(app.get(MailService), 'sendBookingStatusMail')
      .mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await app.close();
  });

  it('is admin-only (401 / 403)', async () => {
    await api().get('/api/admin/bookings').expect(401);
    await api()
      .get('/api/admin/bookings')
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(403);
  });

  describe('GET /api/admin/bookings', () => {
    it('lists all bookings with the guest info', async () => {
      await insertBooking();
      const res = await asAdmin(api().get('/api/admin/bookings')).expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0]).toMatchObject({
        status: 'pending',
        room: { name: 'Mid' },
        user: { id: alice.id, email: alice.email, fullName: 'Alice' },
      });
      expect(res.body.data[0].user.password).toBeUndefined();
    });

    it('filters by status, roomId, userId and check-in range', async () => {
      await insertBooking(BookingStatus.PENDING, catalog.mid, 10);
      await insertBooking(BookingStatus.APPROVED, catalog.luxury, 20);

      const total = async (query: object) =>
        (
          await asAdmin(api().get('/api/admin/bookings').query(query)).expect(
            200,
          )
        ).body.meta.total;

      expect(await total({ status: 'approved' })).toBe(1);
      expect(await total({ roomId: catalog.luxury.id })).toBe(1);
      expect(await total({ userId: alice.id })).toBe(2);
      expect(await total({ userId: admin.id })).toBe(0);
      expect(
        await total({ from: dayFromToday(15), to: dayFromToday(25) }),
      ).toBe(1);
    });

    it('returns 400 for invalid filters', async () => {
      await asAdmin(
        api().get('/api/admin/bookings').query({ roomId: 'x' }),
      ).expect(400);
      await asAdmin(
        api()
          .get('/api/admin/bookings')
          .query({ from: dayFromToday(5), to: dayFromToday(1) }),
      ).expect(400);
    });
  });

  it('GET /api/admin/bookings/:id returns details or 404', async () => {
    const booking = await insertBooking();
    const res = await asAdmin(
      api().get(`/api/admin/bookings/${booking.id}`),
    ).expect(200);
    expect(res.body).toMatchObject({
      id: booking.id,
      user: { email: alice.email },
    });

    await asAdmin(api().get(`/api/admin/bookings/${uuid0}`)).expect(404);
  });

  describe('PATCH /api/admin/bookings/:id/approve', () => {
    it('approves a pending booking and queues the mail', async () => {
      const booking = await insertBooking();
      const res = await asAdmin(
        api().patch(`/api/admin/bookings/${booking.id}/approve`),
      ).expect(200);

      expect(res.body.status).toBe('approved');
      expect(sendMail).toHaveBeenCalledWith({
        to: alice.email,
        fullName: 'Alice',
        roomName: 'Mid',
        checkIn: dayFromToday(10),
        checkOut: dayFromToday(12),
        totalPrice: 0,
        status: 'approved',
        rejectReason: null,
      });
    });

    it('stops the guest from cancelling afterwards', async () => {
      const booking = await insertBooking();
      await asAdmin(
        api().patch(`/api/admin/bookings/${booking.id}/approve`),
      ).expect(200);
      await api()
        .patch(`/api/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(409);
    });

    it.each([
      BookingStatus.APPROVED,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
    ])('returns 409 for a %s booking without sending mail', async (status) => {
      const booking = await insertBooking(status);
      await asAdmin(
        api().patch(`/api/admin/bookings/${booking.id}/approve`),
      ).expect(409);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown booking', async () => {
      await asAdmin(api().patch(`/api/admin/bookings/${uuid0}/approve`)).expect(
        404,
      );
    });

    it('still succeeds if queueing the mail fails', async () => {
      sendMail.mockRejectedValueOnce(new Error('redis down'));
      const booking = await insertBooking();
      await asAdmin(
        api().patch(`/api/admin/bookings/${booking.id}/approve`),
      ).expect(200);
    });
  });

  describe('PATCH /api/admin/bookings/:id/reject', () => {
    const reject = (id: string, body: object) =>
      asAdmin(api().patch(`/api/admin/bookings/${id}/reject`).send(body));

    it('rejects with a trimmed reason, frees the room and queues the mail', async () => {
      const booking = await insertBooking();
      const res = await reject(booking.id, {
        reason: '  Phòng bảo trì  ',
      }).expect(200);

      expect(res.body).toMatchObject({
        status: 'rejected',
        rejectReason: 'Phòng bảo trì',
      });
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          rejectReason: 'Phòng bảo trì',
        }),
      );

      const search = await api()
        .get('/api/rooms')
        .query({ checkIn: dayFromToday(10), checkOut: dayFromToday(12) })
        .expect(200);
      expect(search.body.data.map((r: { name: string }) => r.name)).toContain(
        'Mid',
      );
    });

    it.each([
      {},
      { reason: '' },
      { reason: '   ' },
      { reason: 'x'.repeat(501) },
    ])('requires a reason (%o)', async (body) => {
      const booking = await insertBooking();
      await reject(booking.id, body).expect(400);
    });

    it('returns 409 for a non-pending booking', async () => {
      const booking = await insertBooking(BookingStatus.APPROVED);
      await reject(booking.id, { reason: 'late' }).expect(409);
    });
  });

  it('lets only one of a simultaneous approve and reject win (row lock)', async () => {
    const booking = await insertBooking();
    const results = await Promise.all([
      asAdmin(api().patch(`/api/admin/bookings/${booking.id}/approve`)),
      asAdmin(
        api()
          .patch(`/api/admin/bookings/${booking.id}/reject`)
          .send({ reason: 'x' }),
      ),
    ]);

    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const saved = await catalog.ds
      .getRepository(Booking)
      .findOneByOrFail({ id: booking.id });
    expect(saved.status).toBe(
      results[0].status === 200 ? 'approved' : 'rejected',
    );
  });
});
