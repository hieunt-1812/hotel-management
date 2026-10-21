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
import { Room } from '../src/rooms/entities/room.entity';
import { User } from '../src/users/entities/user.entity';

describe('Bookings (e2e)', () => {
  let app: INestApplication;
  let catalog: Awaited<ReturnType<typeof seedRoomCatalog>>;
  let alice: SeededUser;
  let bob: SeededUser;

  const api = () => request(app.getHttpServer());
  const auth = (user: SeededUser) => ({
    Authorization: `Bearer ${user.token}`,
  });
  const stay = (from: number, to: number) => ({
    checkIn: dayFromToday(from),
    checkOut: dayFromToday(to),
  });
  const book = (user: SeededUser, body: object) =>
    api().post('/api/bookings').set(auth(user)).send(body);
  /** Inserts a booking for alice directly, bypassing the API. */
  const insertBooking = async (status: BookingStatus, from = 10, to = 12) =>
    createBooking(catalog.ds, {
      room: catalog.mid,
      user: await catalog.ds
        .getRepository(User)
        .findOneByOrFail({ id: alice.id }),
      ...stay(from, to),
      status,
    });

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateDatabase(app);
    catalog = await seedRoomCatalog(app);
    alice = await createUser(app, { email: 'alice@example.com' });
    bob = await createUser(app, { email: 'bob@example.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/bookings', () => {
    it('creates a pending booking priced on the server', async () => {
      const res = await book(alice, {
        roomId: catalog.mid.id,
        ...stay(10, 12),
        note: 'Late arrival',
      }).expect(201);

      expect(res.body).toMatchObject({
        status: 'pending',
        ...stay(10, 12),
        nights: 2,
        totalPrice: 1600000, // 800000 x 2
        note: 'Late arrival',
        rejectReason: null,
        room: { id: catalog.mid.id, name: 'Mid', pricePerNight: 800000 },
      });
    });

    it('keeps the price snapshot when the room price changes later', async () => {
      const res = await book(alice, {
        roomId: catalog.mid.id,
        ...stay(10, 11),
      }).expect(201);
      await catalog.ds
        .getRepository(Room)
        .update(catalog.mid.id, { pricePerNight: 999999 });

      const detail = await api()
        .get(`/api/me/bookings/${res.body.id}`)
        .set(auth(alice))
        .expect(200);
      expect(detail.body.totalPrice).toBe(800000);
    });

    it('rejects a client-supplied price and requires login', async () => {
      await book(alice, {
        roomId: catalog.mid.id,
        ...stay(10, 11),
        totalPrice: 1,
      }).expect(400);
      await api()
        .post('/api/bookings')
        .send({ roomId: catalog.mid.id, ...stay(10, 11) })
        .expect(401);
    });

    it('returns 409 when dates overlap a pending/approved booking', async () => {
      await insertBooking(BookingStatus.APPROVED, 10, 12);
      await book(bob, { roomId: catalog.mid.id, ...stay(11, 13) }).expect(409);
      await book(bob, { roomId: catalog.mid.id, ...stay(9, 11) }).expect(409);
    });

    it('allows back-to-back stays and dates freed by rejected/cancelled bookings', async () => {
      await insertBooking(BookingStatus.PENDING, 10, 12);
      await book(bob, { roomId: catalog.mid.id, ...stay(12, 14) }).expect(201);
      await book(bob, { roomId: catalog.mid.id, ...stay(8, 10) }).expect(201);

      await insertBooking(BookingStatus.REJECTED, 20, 22);
      await insertBooking(BookingStatus.CANCELLED, 20, 22);
      await book(bob, { roomId: catalog.mid.id, ...stay(20, 22) }).expect(201);
    });

    it('lets only one of several simultaneous requests win (pessimistic lock)', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          book(alice, { roomId: catalog.luxury.id, ...stay(30, 32) }),
        ),
      );

      const statuses = results.map((r) => r.status).sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      expect(await catalog.ds.getRepository(Booking).countBy({})).toBe(1);
    });

    it('hides the booked room from the availability search', async () => {
      await book(alice, { roomId: catalog.mid.id, ...stay(10, 12) }).expect(
        201,
      );
      const res = await api().get('/api/rooms').query(stay(10, 12)).expect(200);
      expect(res.body.data.map((r: { name: string }) => r.name)).not.toContain(
        'Mid',
      );
    });

    it('returns 404 for unknown or soft-deleted rooms', async () => {
      await book(alice, {
        roomId: '00000000-0000-4000-8000-000000000000',
        ...stay(10, 11),
      }).expect(404);

      await catalog.ds.getRepository(Room).softDelete(catalog.cheap.id);
      await book(alice, { roomId: catalog.cheap.id, ...stay(10, 11) }).expect(
        404,
      );
    });

    it.each([
      ['past checkIn', { ...stay(-1, 1) }],
      ['checkOut = checkIn', { ...stay(5, 5) }],
      ['wrong date format', { checkIn: '01/11/2026', checkOut: '03/11/2026' }],
      ['missing dates', {}],
      ['note too long', { ...stay(5, 6), note: 'x'.repeat(501) }],
    ])('returns 400 for %s', async (_: string, body: object) => {
      await book(alice, { roomId: catalog.mid.id, ...body }).expect(400);
    });
  });

  describe('GET /api/me/bookings', () => {
    beforeEach(async () => {
      await insertBooking(BookingStatus.PENDING, 10, 12);
      await insertBooking(BookingStatus.APPROVED, 20, 22);
      await insertBooking(BookingStatus.CANCELLED, 30, 32);
      await book(bob, { roomId: catalog.luxury.id, ...stay(10, 12) }).expect(
        201,
      );
    });

    const mine = (query: object = {}) =>
      api().get('/api/me/bookings').set(auth(alice)).query(query);

    it("returns only the current user's bookings, newest first", async () => {
      const res = await mine().expect(200);
      expect(res.body.meta.total).toBe(3);
      expect(res.body.data.map((b: { status: string }) => b.status)).toEqual([
        'cancelled',
        'approved',
        'pending',
      ]);
    });

    it('filters by status and check-in date range, and paginates', async () => {
      expect((await mine({ status: 'approved' })).body.meta.total).toBe(1);

      const range = await mine({
        from: dayFromToday(15),
        to: dayFromToday(25),
      }).expect(200);
      expect(range.body.data.map((b: { status: string }) => b.status)).toEqual([
        'approved',
      ]);

      const paged = await mine({ page: 2, limit: 2 }).expect(200);
      expect(paged.body.data).toHaveLength(1);
      expect(paged.body.meta.totalPages).toBe(2);
    });

    it('returns 400 when from is after to or status is unknown', async () => {
      await mine({ from: dayFromToday(5), to: dayFromToday(1) }).expect(400);
      await mine({ status: 'done' }).expect(400);
    });

    it("hides other users' bookings in the detail endpoint", async () => {
      const bobs = await api()
        .get('/api/me/bookings')
        .set(auth(bob))
        .expect(200);
      const bobBookingId = bobs.body.data[0].id;

      await api()
        .get(`/api/me/bookings/${bobBookingId}`)
        .set(auth(bob))
        .expect(200);
      await api()
        .get(`/api/me/bookings/${bobBookingId}`)
        .set(auth(alice))
        .expect(404);
    });
  });

  describe('PATCH /api/bookings/:id/cancel', () => {
    const cancel = (user: SeededUser, id: string) =>
      api().patch(`/api/bookings/${id}/cancel`).set(auth(user));

    it('cancels a pending booking and frees the dates', async () => {
      const { body } = await book(alice, {
        roomId: catalog.mid.id,
        ...stay(10, 12),
      }).expect(201);

      const res = await cancel(alice, body.id).expect(200);
      expect(res.body.status).toBe('cancelled');
      await book(bob, { roomId: catalog.mid.id, ...stay(10, 12) }).expect(201);
    });

    it("returns 403 for someone else's booking", async () => {
      const { body } = await book(alice, {
        roomId: catalog.mid.id,
        ...stay(10, 12),
      }).expect(201);
      await cancel(bob, body.id).expect(403);
    });

    it.each([
      BookingStatus.APPROVED,
      BookingStatus.CANCELLED,
      BookingStatus.REJECTED,
    ])('returns 409 for a %s booking', async (status) => {
      const booking = await insertBooking(status);
      await cancel(alice, booking.id).expect(409);
    });

    it('returns 404 for an unknown booking and 400 for a non-uuid', async () => {
      await cancel(alice, '00000000-0000-4000-8000-000000000000').expect(404);
      await cancel(alice, 'abc').expect(400);
    });
  });
});
