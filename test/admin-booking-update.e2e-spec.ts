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
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../src/payments/entities/payment.entity';
import { Room } from '../src/rooms/entities/room.entity';
import { User, UserRole } from '../src/users/entities/user.entity';
import { MailService } from '../src/mail/mail.service';

describe('Admin update booking (e2e)', () => {
  let app: INestApplication;
  let catalog: Awaited<ReturnType<typeof seedRoomCatalog>>;
  let admin: SeededUser;
  let alice: SeededUser;
  let sendMail: jest.SpyInstance;

  const uuid0 = '00000000-0000-4000-8000-000000000000';
  const api = () => request(app.getHttpServer());
  const update = (id: string, body: object) =>
    api()
      .patch(`/api/admin/bookings/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body);
  const insertBooking = async ({
    status = BookingStatus.PENDING,
    room = catalog.mid,
    from = 10,
    nights = 2,
  }: {
    status?: BookingStatus;
    room?: Room;
    from?: number;
    nights?: number;
  } = {}) =>
    createBooking(catalog.ds, {
      room,
      user: await catalog.ds
        .getRepository(User)
        .findOneByOrFail({ id: alice.id }),
      checkIn: dayFromToday(from),
      checkOut: dayFromToday(from + nights),
      status,
      totalPrice: room.pricePerNight * nights,
    });
  const reload = (id: string) =>
    catalog.ds.getRepository(Booking).findOneOrFail({
      where: { id },
      relations: { room: true },
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
      .spyOn(app.get(MailService), 'sendBookingUpdatedMail')
      .mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await app.close();
  });

  it('is admin-only (401 / 403)', async () => {
    const booking = await insertBooking();
    await api()
      .patch(`/api/admin/bookings/${booking.id}`)
      .send({ note: 'x' })
      .expect(401);
    await api()
      .patch(`/api/admin/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ note: 'x' })
      .expect(403);
  });

  it('changes the dates, recalculates the price and mails the guest', async () => {
    const booking = await insertBooking();
    const checkIn = dayFromToday(12);
    const checkOut = dayFromToday(15);

    const res = await update(booking.id, { checkIn, checkOut }).expect(200);

    expect(res.body).toMatchObject({
      id: booking.id,
      status: 'pending',
      checkIn,
      checkOut,
      nights: 3,
      totalPrice: 2400000,
      room: { id: catalog.mid.id },
      user: { id: alice.id },
    });
    expect(sendMail).toHaveBeenCalledWith({
      to: alice.email,
      fullName: 'Alice',
      previous: {
        roomName: 'Mid',
        checkIn: dayFromToday(10),
        checkOut: dayFromToday(12),
        totalPrice: 1600000,
        note: null,
      },
      current: {
        roomName: 'Mid',
        checkIn,
        checkOut,
        totalPrice: 2400000,
        note: null,
      },
    });
  });

  it('moves an approved booking to another room at that room price', async () => {
    const booking = await insertBooking({ status: BookingStatus.APPROVED });

    const res = await update(booking.id, { roomId: catalog.luxury.id }).expect(
      200,
    );

    expect(res.body).toMatchObject({
      status: 'approved',
      room: { id: catalog.luxury.id, name: 'Luxury' },
      totalPrice: 4000000,
    });
    expect((await reload(booking.id)).room.id).toBe(catalog.luxury.id);
  });

  it('updates only the note and keeps the price', async () => {
    const booking = await insertBooking();

    const res = await update(booking.id, { note: 'Thêm giường phụ' }).expect(
      200,
    );

    expect(res.body).toMatchObject({
      note: 'Thêm giường phụ',
      totalPrice: 1600000,
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('does not mail when nothing actually changes', async () => {
    const booking = await insertBooking();

    await update(booking.id, { checkIn: dayFromToday(10) }).expect(200);

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('lets the new dates overlap the booking itself', async () => {
    const booking = await insertBooking();

    await update(booking.id, { checkIn: dayFromToday(11) }).expect(200);

    expect((await reload(booking.id)).checkIn).toBe(dayFromToday(11));
  });

  it('returns 409 when the room is taken in the new dates', async () => {
    const booking = await insertBooking();
    await insertBooking({
      room: catalog.luxury,
      status: BookingStatus.APPROVED,
      from: 11,
    });
    await insertBooking({ from: 20 });

    await update(booking.id, { roomId: catalog.luxury.id }).expect(409);
    await update(booking.id, {
      checkIn: dayFromToday(19),
      checkOut: dayFromToday(21),
    }).expect(409);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('frees the room again when the other booking was rejected or cancelled', async () => {
    const booking = await insertBooking();
    await insertBooking({
      room: catalog.luxury,
      status: BookingStatus.CANCELLED,
    });

    await update(booking.id, { roomId: catalog.luxury.id }).expect(200);
  });

  it.each([
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
  ])('returns 409 for a %s booking', async (status) => {
    const booking = await insertBooking({ status });
    await update(booking.id, { note: 'x' }).expect(409);
  });

  it('blocks room or date changes on a paid booking but allows the note', async () => {
    const booking = await insertBooking({ status: BookingStatus.APPROVED });
    await catalog.ds.getRepository(Payment).save({
      booking,
      amount: booking.totalPrice,
      method: PaymentMethod.CASH,
      status: PaymentStatus.PAID,
      paidAt: new Date(),
    });

    await update(booking.id, { checkOut: dayFromToday(13) }).expect(409);
    await update(booking.id, { roomId: catalog.luxury.id }).expect(409);
    await update(booking.id, { note: 'Khách đến muộn' }).expect(200);
    expect((await reload(booking.id)).totalPrice).toBe(1600000);
  });

  it('validates the body and the stay dates (400)', async () => {
    const booking = await insertBooking();

    await update(booking.id, {}).expect(400);
    await update(booking.id, { checkIn: '2026-13-01' }).expect(400);
    await update(booking.id, { roomId: 'abc' }).expect(400);
    await update(booking.id, { status: 'approved' }).expect(400);
    await update(booking.id, { checkOut: dayFromToday(9) }).expect(400);
    await update(booking.id, { checkIn: dayFromToday(-1) }).expect(400);
  });

  it('returns 404 for an unknown booking or room', async () => {
    const booking = await insertBooking();

    await update(uuid0, { note: 'x' }).expect(404);
    await update(booking.id, { roomId: uuid0 }).expect(404);
    await catalog.ds.getRepository(Room).softDelete(catalog.luxury.id);
    await update(booking.id, { roomId: catalog.luxury.id }).expect(404);
  });

  it('still succeeds if queueing the mail fails', async () => {
    sendMail.mockRejectedValue(new Error('redis down'));
    const booking = await insertBooking();

    await update(booking.id, { note: 'x' }).expect(200);
    expect((await reload(booking.id)).note).toBe('x');
  });
});
