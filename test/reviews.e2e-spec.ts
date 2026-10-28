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
import { BookingStatus } from '../src/bookings/entities/booking.entity';
import { Review } from '../src/reviews/entities/review.entity';
import { User, UserRole } from '../src/users/entities/user.entity';

describe('Reviews (e2e)', () => {
  let app: INestApplication;
  let catalog: Awaited<ReturnType<typeof seedRoomCatalog>>;
  let alice: SeededUser;
  let bob: SeededUser;
  let admin: SeededUser;

  const uuid0 = '00000000-0000-4000-8000-000000000000';
  const review = (
    user: SeededUser,
    bookingId: string,
    body: object = { rating: 5, comment: 'Tuyệt vời' },
  ) =>
    request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/review`)
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);
  const moderate = (
    user: SeededUser,
    reviewId: string,
    action: 'approve' | 'reject',
  ) =>
    request(app.getHttpServer())
      .patch(`/api/admin/reviews/${reviewId}/${action}`)
      .set('Authorization', `Bearer ${user.token}`);
  const listReviews = (user: SeededUser, query = '') =>
    request(app.getHttpServer())
      .get(`/api/admin/reviews${query}`)
      .set('Authorization', `Bearer ${user.token}`);
  const aliceBooking = async (status = BookingStatus.COMPLETED) =>
    createBooking(catalog.ds, {
      room: catalog.mid,
      user: await catalog.ds
        .getRepository(User)
        .findOneByOrFail({ id: alice.id }),
      checkIn: dayFromToday(-3),
      checkOut: dayFromToday(-1),
      status,
    });

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateDatabase(app);
    catalog = await seedRoomCatalog(app);
    alice = await createUser(app, {
      email: 'alice@example.com',
      fullName: 'Alice',
    });
    bob = await createUser(app, { email: 'bob@example.com' });
    admin = await createUser(app, {
      email: 'admin@example.com',
      fullName: 'Admin',
      role: UserRole.ADMIN,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/bookings/:id/review', () => {
    it('creates a pending review for a completed booking', async () => {
      const booking = await aliceBooking();

      const res = await review(alice, booking.id, {
        rating: 4,
        comment: '  Phòng sạch  ',
      }).expect(201);

      expect(res.body).toMatchObject({
        bookingId: booking.id,
        rating: 4,
        comment: 'Phòng sạch',
        status: 'pending',
      });
    });

    it('allows a review without comment', async () => {
      const booking = await aliceBooking();
      const res = await review(alice, booking.id, { rating: 3 }).expect(201);
      expect(res.body.comment).toBeNull();
    });

    it('returns 409 when the booking already has a review', async () => {
      const booking = await aliceBooking();
      await review(alice, booking.id).expect(201);
      await review(alice, booking.id).expect(409);
    });

    it('lets only one of two simultaneous reviews succeed', async () => {
      const booking = await aliceBooking();
      const results = await Promise.all([
        review(alice, booking.id),
        review(alice, booking.id),
      ]);

      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      expect(await catalog.ds.getRepository(Review).count()).toBe(1);
    });

    it.each([
      BookingStatus.PENDING,
      BookingStatus.APPROVED,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
    ])('returns 409 for a %s booking', async (status) => {
      const booking = await aliceBooking(status);
      await review(alice, booking.id).expect(409);
    });

    it("returns 403 for someone else's booking and 404 for an unknown one", async () => {
      const booking = await aliceBooking();
      await review(bob, booking.id).expect(403);
      await review(alice, uuid0).expect(404);
    });

    it.each([
      { rating: 0 },
      { rating: 6 },
      { rating: 4.5 },
      {},
      { rating: 5, comment: 'x'.repeat(1001) },
      { rating: 5, status: 'approved' },
    ])('rejects invalid body %o', async (body) => {
      const booking = await aliceBooking();
      await review(alice, booking.id, body).expect(400);
    });

    it('requires login', async () => {
      const booking = await aliceBooking();
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/review`)
        .send({ rating: 5 })
        .expect(401);
    });
  });

  describe('admin moderation', () => {
    it('lists reviews filtered by status with booking, room and reviewer', async () => {
      const first = await aliceBooking();
      const second = await aliceBooking();
      const { body: kept } = await review(alice, first.id).expect(201);
      const { body: done } = await review(alice, second.id).expect(201);
      await moderate(admin, done.id, 'approve').expect(200);

      const res = await listReviews(admin, '?status=pending').expect(200);

      expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: 1 });
      expect(res.body.data[0]).toMatchObject({
        id: kept.id,
        status: 'pending',
        booking: { id: first.id },
        room: { id: catalog.mid.id, name: 'Mid' },
        user: { id: alice.id, email: 'alice@example.com', fullName: 'Alice' },
        moderatedBy: null,
      });
      expect(res.body.data[0].user.password).toBeUndefined();

      const all = await listReviews(admin).expect(200);
      expect(all.body.meta.total).toBe(2);
      await listReviews(admin, '?status=unknown').expect(400);
    });

    it('approves a review, records the admin and shows it on the room page', async () => {
      const booking = await aliceBooking();
      const { body: created } = await review(alice, booking.id).expect(201);

      const res = await moderate(admin, created.id, 'approve').expect(200);
      expect(res.body).toMatchObject({
        status: 'approved',
        moderatedBy: { id: admin.id, fullName: 'Admin' },
      });

      const publicRes = await request(app.getHttpServer())
        .get(`/api/rooms/${catalog.mid.id}/reviews`)
        .expect(200);
      expect(publicRes.body.meta.total).toBe(1);
      expect(publicRes.body.data[0]).toMatchObject({
        id: created.id,
        rating: 5,
        reviewer: 'Alice',
      });
    });

    it('rejects a review and keeps it off the room page', async () => {
      const booking = await aliceBooking();
      const { body: created } = await review(alice, booking.id).expect(201);

      const res = await moderate(admin, created.id, 'reject').expect(200);
      expect(res.body.status).toBe('rejected');

      const publicRes = await request(app.getHttpServer())
        .get(`/api/rooms/${catalog.mid.id}/reviews`)
        .expect(200);
      expect(publicRes.body.meta.total).toBe(0);
    });

    it('only moderates pending reviews', async () => {
      const booking = await aliceBooking();
      const { body: created } = await review(alice, booking.id).expect(201);
      await moderate(admin, created.id, 'approve').expect(200);

      await moderate(admin, created.id, 'approve').expect(409);
      await moderate(admin, created.id, 'reject').expect(409);
      await moderate(admin, uuid0, 'approve').expect(404);
    });

    it('lets only one of approve/reject win when sent together', async () => {
      const booking = await aliceBooking();
      const { body: created } = await review(alice, booking.id).expect(201);

      const results = await Promise.all([
        moderate(admin, created.id, 'approve'),
        moderate(admin, created.id, 'reject'),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 409,
      ]);
    });

    it('is admin only', async () => {
      const booking = await aliceBooking();
      const { body: created } = await review(alice, booking.id).expect(201);

      await listReviews(alice).expect(403);
      await moderate(alice, created.id, 'approve').expect(403);
      await request(app.getHttpServer()).get('/api/admin/reviews').expect(401);
    });
  });
});
