import { INestApplication } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { createTestApp } from './utils/test-app.factory';
import { truncateDatabase } from './utils/database.helper';
import { User } from '../src/users/entities/user.entity';
import { RoomType } from '../src/rooms/entities/room-type.entity';
import { Amenity } from '../src/rooms/entities/amenity.entity';
import { BedType, Room, RoomView } from '../src/rooms/entities/room.entity';
import { RoomImage } from '../src/rooms/entities/room-image.entity';
import {
  Booking,
  BookingStatus,
} from '../src/bookings/entities/booking.entity';
import {
  Payment,
  PaymentMethod,
} from '../src/payments/entities/payment.entity';
import { Review } from '../src/reviews/entities/review.entity';

describe('Entities & relations (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
  });

  beforeEach(() => truncateDatabase(app));

  afterAll(async () => {
    await app.close();
  });

  /** Seeds user → room (type, amenity, image) → booking and returns them. */
  async function seedBooking() {
    const user = await ds.getRepository(User).save({
      email: 'guest@example.com',
      password: 'hash',
      fullName: 'Guest',
      phone: '0912345678',
    });
    const roomType = await ds.getRepository(RoomType).save({ name: 'Deluxe' });
    const wifi = await ds.getRepository(Amenity).save({ name: 'wifi' });
    const room = await ds.getRepository(Room).save({
      name: 'Room 101',
      pricePerNight: 500000,
      capacity: 2,
      bedType: BedType.DOUBLE,
      view: RoomView.SEA,
      roomType,
      amenities: [wifi],
    });
    await ds.getRepository(RoomImage).save({ url: '/uploads/101.png', room });
    const booking = await ds.getRepository(Booking).save({
      user,
      room,
      checkIn: '2026-11-01',
      checkOut: '2026-11-03',
      totalPrice: 1000000,
    });
    return { user, room, booking };
  }

  it('saves and loads relations across all tables', async () => {
    const { user, booking } = await seedBooking();
    await ds.getRepository(Payment).save({
      booking,
      amount: booking.totalPrice,
      method: PaymentMethod.CASH,
    });
    await ds.getRepository(Review).save({ booking, rating: 5 });

    const loaded = await ds.getRepository(Booking).findOneOrFail({
      where: { id: booking.id },
      relations: {
        user: true,
        room: { roomType: true, amenities: true, images: true },
        payments: true,
        review: true,
      },
    });

    expect(loaded.status).toBe(BookingStatus.PENDING);
    expect(loaded.totalPrice).toBe(1000000);
    expect(loaded.user.id).toBe(user.id);
    expect(loaded.room.pricePerNight).toBe(500000);
    expect(loaded.room.roomType.name).toBe('Deluxe');
    expect(loaded.room.amenities.map((a) => a.name)).toEqual(['wifi']);
    expect(loaded.room.images).toHaveLength(1);
    expect(loaded.payments[0].amount).toBe(1000000);
    expect(loaded.review?.rating).toBe(5);
  });

  it('allows only one review per booking', async () => {
    const { booking } = await seedBooking();
    await ds.getRepository(Review).save({ booking, rating: 4 });

    await expect(
      ds.getRepository(Review).save({ booking, rating: 3 }),
    ).rejects.toThrow(QueryFailedError);
  });

  it('rejects a rating outside 1-5', async () => {
    const { booking } = await seedBooking();
    await expect(
      ds.getRepository(Review).save({ booking, rating: 6 }),
    ).rejects.toThrow(QueryFailedError);
  });

  it('soft-deletes rooms (hidden from find, kept in DB)', async () => {
    const { room } = await seedBooking();
    await ds.getRepository(Room).softDelete(room.id);

    expect(await ds.getRepository(Room).findOneBy({ id: room.id })).toBeNull();
    const withDeleted = await ds
      .getRepository(Room)
      .findOne({ where: { id: room.id }, withDeleted: true });
    expect(withDeleted?.deletedAt).toBeInstanceOf(Date);
  });
});
