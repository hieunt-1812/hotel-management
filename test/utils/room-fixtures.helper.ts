import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../src/users/entities/user.entity';
import { RoomType } from '../../src/rooms/entities/room-type.entity';
import { Amenity } from '../../src/rooms/entities/amenity.entity';
import { RoomImage } from '../../src/rooms/entities/room-image.entity';
import { BedType, Room, RoomView } from '../../src/rooms/entities/room.entity';
import {
  Booking,
  BookingStatus,
} from '../../src/bookings/entities/booking.entity';

/** Seeds a small, known catalog for room search tests. */
export async function seedRoomCatalog(app: INestApplication) {
  const ds = app.get(DataSource);
  const [standard, deluxe] = await ds
    .getRepository(RoomType)
    .save([{ name: 'Standard' }, { name: 'Deluxe' }]);
  const [ac, wifi, tv] = await ds
    .getRepository(Amenity)
    .save([{ name: 'air_conditioner' }, { name: 'wifi' }, { name: 'tv' }]);

  const roomRepo = ds.getRepository(Room);
  const base = { bedType: BedType.DOUBLE, view: RoomView.CITY, capacity: 2 };
  // Saved one by one so created_at order is deterministic (cheap → expensive)
  const cheap = await roomRepo.save({
    ...base,
    name: 'Cheap',
    pricePerNight: 300000,
    bedType: BedType.SINGLE,
    capacity: 1,
    roomType: standard,
    amenities: [wifi],
  });
  const mid = await roomRepo.save({
    ...base,
    name: 'Mid',
    pricePerNight: 800000,
    roomType: standard,
    amenities: [ac, wifi],
  });
  const luxury = await roomRepo.save({
    ...base,
    name: 'Luxury',
    pricePerNight: 2000000,
    capacity: 4,
    view: RoomView.SEA,
    roomType: deluxe,
    amenities: [ac, wifi, tv],
  });
  await ds
    .getRepository(RoomImage)
    .save({ url: '/uploads/lux.png', room: luxury });

  const guest = await ds.getRepository(User).save({
    email: 'guest@example.com',
    password: 'hash',
    fullName: 'Guest Reviewer',
    phone: '0912345678',
  });

  return { ds, standard, deluxe, cheap, mid, luxury, guest };
}

export function createBooking(
  ds: DataSource,
  data: {
    room: Room;
    user: User;
    checkIn: string;
    checkOut: string;
    status?: BookingStatus;
  },
) {
  return ds.getRepository(Booking).save({ totalPrice: 0, ...data });
}

/** YYYY-MM-DD, `days` from today (server local time). */
export function dayFromToday(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('sv-SE');
}
