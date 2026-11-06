import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import request from 'supertest';
import { createTestApp } from './utils/test-app.factory';
import { truncateDatabase } from './utils/database.helper';
import { createUser, SeededUser } from './utils/seed.helper';
import { createBooking, seedRoomCatalog } from './utils/room-fixtures.helper';
import { BookingStatus } from '../src/bookings/entities/booking.entity';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../src/payments/entities/payment.entity';
import { Room } from '../src/rooms/entities/room.entity';
import { User, UserRole } from '../src/users/entities/user.entity';
import { MailService } from '../src/mail/mail.service';
import { MonthlyRevenueReportCron } from '../src/statistics/monthly-revenue-report.cron';
import {
  MONTHLY_REVENUE_REPORT_DEFAULT_CRON,
  MONTHLY_REVENUE_REPORT_JOB,
} from '../src/statistics/statistics.constants';

describe('Admin statistics (e2e)', () => {
  let app: INestApplication;
  let catalog: Awaited<ReturnType<typeof seedRoomCatalog>>;
  let admin: SeededUser;
  let sendRevenueMail: jest.SpyInstance;

  const get = (path: string, token = admin.token) =>
    request(app.getHttpServer())
      .get(`/api/admin/statistics/${path}`)
      .set('Authorization', `Bearer ${token}`);

  const bookAt = async (
    room: Room,
    createdAt: string,
    status = BookingStatus.PENDING,
  ) => {
    const booking = await createBooking(catalog.ds, {
      room,
      user: catalog.guest,
      checkIn: '2026-12-01',
      checkOut: '2026-12-02',
      status,
    });
    await catalog.ds.query(
      'UPDATE bookings SET created_at = $1 WHERE id = $2',
      [createdAt, booking.id],
    );
    return booking;
  };

  const payAt = async (
    room: Room,
    amount: number,
    paidAt: string | null,
    status = PaymentStatus.PAID,
  ) => {
    const booking = await bookAt(room, '2026-01-01', BookingStatus.APPROVED);
    await catalog.ds.getRepository(Payment).insert({
      booking: { id: booking.id },
      amount,
      method: PaymentMethod.CASH,
      status,
      paidAt: paidAt ? new Date(paidAt) : null,
    });
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateDatabase(app);
    catalog = await seedRoomCatalog(app);
    admin = await createUser(app, {
      email: 'admin@example.com',
      fullName: 'Main Admin',
      role: UserRole.ADMIN,
    });
    sendRevenueMail = jest
      .spyOn(app.get(MailService), 'sendMonthlyRevenueMail')
      .mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/admin/statistics/bookings', () => {
    beforeEach(async () => {
      await bookAt(catalog.mid, '2026-01-15T10:00:00');
      await bookAt(
        catalog.cheap,
        '2026-01-31T23:59:00',
        BookingStatus.APPROVED,
      );
      await bookAt(
        catalog.luxury,
        '2026-03-10T08:00:00',
        BookingStatus.CANCELLED,
      );
      await bookAt(
        catalog.luxury,
        '2026-11-02T08:00:00',
        BookingStatus.COMPLETED,
      );
      await bookAt(catalog.mid, '2025-12-31T23:59:00');
      await bookAt(catalog.mid, '2027-01-01T00:00:00');
    });

    it('counts bookings per month with a status breakdown and zero-filled months', async () => {
      const res = await get('bookings?year=2026&groupBy=month').expect(200);

      expect(res.body).toMatchObject({ year: 2026, groupBy: 'month' });
      expect(res.body.data).toHaveLength(12);
      expect(res.body.data[0]).toEqual({
        period: 1,
        total: 2,
        pending: 1,
        approved: 1,
        rejected: 0,
        cancelled: 0,
        completed: 0,
      });
      expect(res.body.data[1]).toMatchObject({ period: 2, total: 0 });
      expect(res.body.data[2]).toMatchObject({ total: 1, cancelled: 1 });
      expect(res.body.summary).toMatchObject({
        total: 4,
        pending: 1,
        approved: 1,
        cancelled: 1,
        completed: 1,
      });
    });

    it('groups by quarter', async () => {
      const res = await get('bookings?year=2026&groupBy=quarter').expect(200);

      expect(res.body.data.map((row) => [row.period, row.total])).toEqual([
        [1, 3],
        [2, 0],
        [3, 0],
        [4, 1],
      ]);
    });

    it('groups by room type and keeps bookings of soft-deleted rooms', async () => {
      await catalog.ds.getRepository(Room).softDelete(catalog.luxury.id);

      const res = await get('bookings?year=2026&groupBy=roomType').expect(200);

      expect(res.body.data).toEqual([
        expect.objectContaining({
          roomType: { id: catalog.deluxe.id, name: 'Deluxe' },
          total: 2,
          cancelled: 1,
          completed: 1,
        }),
        expect.objectContaining({
          roomType: { id: catalog.standard.id, name: 'Standard' },
          total: 2,
        }),
      ]);
    });

    it('filters by room type', async () => {
      const res = await get(
        `bookings?year=2026&roomTypeId=${catalog.standard.id}`,
      ).expect(200);

      expect(res.body.roomTypeId).toBe(catalog.standard.id);
      expect(res.body.summary.total).toBe(2);
      expect(res.body.data[2].total).toBe(0);
    });

    it.each(['groupBy=week', 'year=1999', 'year=abc', 'roomTypeId=abc'])(
      'returns 400 for %s',
      async (query) => {
        await get(`bookings?${query}`).expect(400);
      },
    );
  });

  describe('GET /api/admin/statistics/revenue', () => {
    beforeEach(async () => {
      await payAt(catalog.mid, 800000, '2026-03-01T00:00:00');
      await payAt(catalog.luxury, 2000000, '2026-03-01T15:00:00');
      await payAt(catalog.cheap, 300000, '2026-03-03T23:59:59');
      await payAt(catalog.mid, 500000, '2026-02-28T23:59:59');
      await payAt(catalog.mid, 700000, '2026-04-01T00:00:00');
      await payAt(catalog.luxury, 9000000, null, PaymentStatus.PENDING);
    });

    it('sums paid payments per day, zero-filling days without revenue', async () => {
      const res = await get(
        'revenue?from=2026-03-01&to=2026-03-03&groupBy=day',
      ).expect(200);

      expect(res.body).toMatchObject({
        from: '2026-03-01',
        to: '2026-03-03',
        groupBy: 'day',
        totalRevenue: 3100000,
        totalPayments: 3,
      });
      expect(res.body.data).toEqual([
        { period: '2026-03-01', revenue: 2800000, payments: 2 },
        { period: '2026-03-02', revenue: 0, payments: 0 },
        { period: '2026-03-03', revenue: 300000, payments: 1 },
      ]);
    });

    it('sums per month', async () => {
      const res = await get(
        'revenue?from=2026-02-01&to=2026-04-30&groupBy=month',
      ).expect(200);

      expect(res.body.data).toEqual([
        { period: '2026-02', revenue: 500000, payments: 1 },
        { period: '2026-03', revenue: 3100000, payments: 3 },
        { period: '2026-04', revenue: 700000, payments: 1 },
      ]);
      expect(res.body.totalRevenue).toBe(4300000);
    });

    it('sums per room type and filters by room type', async () => {
      const byType = await get(
        'revenue?from=2026-03-01&to=2026-03-31&groupBy=roomType',
      ).expect(200);
      expect(byType.body.data).toEqual([
        {
          roomType: { id: catalog.deluxe.id, name: 'Deluxe' },
          revenue: 2000000,
          payments: 1,
        },
        {
          roomType: { id: catalog.standard.id, name: 'Standard' },
          revenue: 1100000,
          payments: 2,
        },
      ]);

      const filtered = await get(
        `revenue?from=2026-03-01&to=2026-03-31&groupBy=month&roomTypeId=${catalog.deluxe.id}`,
      ).expect(200);
      expect(filtered.body.data).toEqual([
        { period: '2026-03', revenue: 2000000, payments: 1 },
      ]);
    });

    it('defaults to the current month up to today', async () => {
      const today = new Date().toLocaleDateString('sv-SE');

      const res = await get('revenue').expect(200);

      expect(res.body).toMatchObject({
        from: `${today.slice(0, 7)}-01`,
        to: today,
        groupBy: 'day',
      });
      expect(res.body.data.at(-1).period).toBe(today);
    });

    it.each([
      'from=2026-03-05&to=2026-03-01',
      'from=2026-01-01&to=2027-01-02&groupBy=day',
      'from=2026-02-30',
      'groupBy=year',
    ])('returns 400 for %s', async (query) => {
      await get(`revenue?${query}`).expect(400);
    });

    it('allows a full leap year by day', async () => {
      const res = await get(
        'revenue?from=2028-01-01&to=2028-12-31&groupBy=day',
      ).expect(200);
      expect(res.body.data).toHaveLength(366);
    });
  });

  describe('monthly revenue report', () => {
    beforeEach(async () => {
      await payAt(catalog.luxury, 2000000, '2026-03-15T10:00:00');
      await payAt(catalog.mid, 800000, '2026-03-31T22:00:00');
      await payAt(catalog.mid, 700000, '2026-04-01T00:00:00');
      await createUser(app, { email: 'user@example.com' });
      const locked = await createUser(app, {
        email: 'locked-admin@example.com',
        role: UserRole.ADMIN,
      });
      await catalog.ds
        .getRepository(User)
        .update(locked.id, { isActive: false });
    });

    const expectedMail = {
      to: 'admin@example.com',
      fullName: 'Main Admin',
      month: '2026-03',
      totalRevenue: 2800000,
      totalPayments: 2,
      byRoomType: [
        { name: 'Deluxe', revenue: 2000000, payments: 1 },
        { name: 'Standard', revenue: 800000, payments: 1 },
      ],
    };

    it('mails the report to active admins on demand', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/statistics/revenue/monthly-report')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ month: '2026-03' })
        .expect(202);

      expect(res.body).toEqual({ month: '2026-03', recipients: 1 });
      expect(sendRevenueMail).toHaveBeenCalledTimes(1);
      expect(sendRevenueMail).toHaveBeenCalledWith(expectedMail);
    });

    it('returns 400 for an invalid month', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/statistics/revenue/monthly-report')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ month: '2026-13' })
        .expect(400);
      expect(sendRevenueMail).not.toHaveBeenCalled();
    });

    it('registers the cron with the default 23:00 schedule', () => {
      const job = app
        .get(SchedulerRegistry)
        .getCronJob(MONTHLY_REVENUE_REPORT_JOB);
      expect(job.cronTime.source).toBe(MONTHLY_REVENUE_REPORT_DEFAULT_CRON);
      expect(job.isActive).toBe(true);
    });

    it('sends only on the last day of the month', async () => {
      const cron = app.get(MonthlyRevenueReportCron);

      await cron.run(new Date(2026, 2, 30, 23));
      expect(sendRevenueMail).not.toHaveBeenCalled();

      await cron.run(new Date(2026, 2, 31, 23));
      expect(sendRevenueMail).toHaveBeenCalledWith(expectedMail);
    });

    it('logs instead of crashing when sending fails', async () => {
      sendRevenueMail.mockRejectedValue(new Error('redis down'));

      await expect(
        app.get(MonthlyRevenueReportCron).run(new Date(2026, 2, 31, 23)),
      ).resolves.toBeUndefined();
    });
  });

  it('rejects non-admins and anonymous requests', async () => {
    const user = await createUser(app, { email: 'user@example.com' });
    await get('bookings', user.token).expect(403);
    await get('revenue', user.token).expect(403);
    await request(app.getHttpServer())
      .post('/api/admin/statistics/revenue/monthly-report')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/statistics/revenue')
      .expect(401);
  });
});
