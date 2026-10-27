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
import { Payment } from '../src/payments/entities/payment.entity';
import { User } from '../src/users/entities/user.entity';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let catalog: Awaited<ReturnType<typeof seedRoomCatalog>>;
  let alice: SeededUser;
  let bob: SeededUser;

  const uuid0 = '00000000-0000-4000-8000-000000000000';
  const pay = (
    user: SeededUser,
    bookingId: string,
    body: object = { method: 'card' },
  ) =>
    request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/payments`)
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);
  const aliceBooking = async (status: BookingStatus, totalPrice = 1600000) =>
    createBooking(catalog.ds, {
      room: catalog.mid,
      user: await catalog.ds
        .getRepository(User)
        .findOneByOrFail({ id: alice.id }),
      checkIn: dayFromToday(10),
      checkOut: dayFromToday(12),
      status,
      totalPrice,
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

  it('pays an approved booking with the amount taken from the booking', async () => {
    const booking = await aliceBooking(BookingStatus.APPROVED);

    const res = await pay(alice, booking.id, {
      method: 'bank_transfer',
    }).expect(201);

    expect(res.body).toMatchObject({
      bookingId: booking.id,
      amount: 1600000,
      method: 'bank_transfer',
      status: 'paid',
    });
    expect(new Date(res.body.paidAt).getTime()).not.toBeNaN();
  });

  it('rejects an amount sent by the client', async () => {
    const booking = await aliceBooking(BookingStatus.APPROVED);
    await pay(alice, booking.id, { method: 'card', amount: 1 }).expect(400);
  });

  it('returns 409 when the booking is already paid', async () => {
    const booking = await aliceBooking(BookingStatus.APPROVED);
    await pay(alice, booking.id).expect(201);
    await pay(alice, booking.id).expect(409);
  });

  it('lets only one of two simultaneous payments succeed', async () => {
    const booking = await aliceBooking(BookingStatus.APPROVED);
    const results = await Promise.all([
      pay(alice, booking.id),
      pay(alice, booking.id),
    ]);

    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(await catalog.ds.getRepository(Payment).count()).toBe(1);
  });

  it.each([
    BookingStatus.PENDING,
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
  ])('returns 409 for a %s booking', async (status) => {
    const booking = await aliceBooking(status);
    await pay(alice, booking.id).expect(409);
  });

  it("returns 403 for someone else's booking and 404 for an unknown one", async () => {
    const booking = await aliceBooking(BookingStatus.APPROVED);
    await pay(bob, booking.id).expect(403);
    await pay(alice, uuid0).expect(404);
  });

  it('validates the method and requires login', async () => {
    const booking = await aliceBooking(BookingStatus.APPROVED);
    await pay(alice, booking.id, { method: 'bitcoin' }).expect(400);
    await pay(alice, booking.id, {}).expect(400);
    await request(app.getHttpServer())
      .post(`/api/bookings/${booking.id}/payments`)
      .send({ method: 'card' })
      .expect(401);
  });
});
