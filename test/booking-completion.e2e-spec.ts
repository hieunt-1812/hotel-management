import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
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
import { UserRole } from '../src/users/entities/user.entity';
import {
  BOOKING_COMPLETION_JOB,
  BookingCompletionCron,
} from '../src/bookings/booking-completion.cron';

describe('Booking completion (e2e)', () => {
  let app: INestApplication;
  let catalog: Awaited<ReturnType<typeof seedRoomCatalog>>;
  let admin: SeededUser;

  const uuid0 = '00000000-0000-4000-8000-000000000000';
  const book = (status: BookingStatus, from: number, to: number) =>
    createBooking(catalog.ds, {
      room: catalog.mid,
      user: catalog.guest,
      checkIn: dayFromToday(from),
      checkOut: dayFromToday(to),
      status,
    });
  const statusOf = async (id: string) =>
    (await catalog.ds.getRepository(Booking).findOneByOrFail({ id })).status;
  const complete = (id: string) =>
    request(app.getHttpServer())
      .patch(`/api/admin/bookings/${id}/complete`)
      .set('Authorization', `Bearer ${admin.token}`);

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('cron job', () => {
    it('is registered with the default nightly schedule', () => {
      const job = app.get(SchedulerRegistry).getCronJob(BOOKING_COMPLETION_JOB);
      expect(job.cronTime.source).toBe('0 1 * * *');
      expect(job.isActive).toBe(true);
    });

    it('completes only approved bookings whose check-out has passed', async () => {
      const finished = await book(BookingStatus.APPROVED, -3, -1);
      const checkoutToday = await book(BookingStatus.APPROVED, -2, 0);
      const upcoming = await book(BookingStatus.APPROVED, 5, 7);
      const pendingPast = await book(BookingStatus.PENDING, -10, -8);

      await app.get(BookingCompletionCron).run();

      expect(await statusOf(finished.id)).toBe('completed');
      expect(await statusOf(checkoutToday.id)).toBe('completed');
      expect(await statusOf(upcoming.id)).toBe('approved');
      expect(await statusOf(pendingPast.id)).toBe('pending');
    });
  });

  describe('PATCH /api/admin/bookings/:id/complete', () => {
    it('completes an approved booking after check-out', async () => {
      const booking = await book(BookingStatus.APPROVED, -3, -1);
      const res = await complete(booking.id).expect(200);
      expect(res.body).toMatchObject({ id: booking.id, status: 'completed' });
    });

    it('returns 400 before the check-out date', async () => {
      const booking = await book(BookingStatus.APPROVED, 5, 7);
      await complete(booking.id).expect(400);
      expect(await statusOf(booking.id)).toBe('approved');
    });

    it.each([
      BookingStatus.PENDING,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
      BookingStatus.COMPLETED,
    ])('returns 409 for a %s booking', async (status) => {
      const booking = await book(status, -3, -1);
      await complete(booking.id).expect(409);
    });

    it('returns 404 for an unknown booking and 403 for non-admins', async () => {
      await complete(uuid0).expect(404);
      const user = await createUser(app, { email: 'user@example.com' });
      const booking = await book(BookingStatus.APPROVED, -3, -1);
      await request(app.getHttpServer())
        .patch(`/api/admin/bookings/${booking.id}/complete`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(403);
    });
  });
});
