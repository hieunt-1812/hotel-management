import { EntityManager } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { countNights } from '../../common/utils/stay-dates.util';

const DEMO_GUEST_EMAIL = 'user@hotel.local';
const DEMO_ROOM_NAME = 'Room 101';

const daysFromToday = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('sv-SE');
};

export async function seedBookings(manager: EntityManager) {
  const user = await manager.findOneBy(User, { email: DEMO_GUEST_EMAIL });
  const room = await manager.findOneBy(Room, { name: DEMO_ROOM_NAME });
  if (!user || !room) return 0;
  if (await manager.existsBy(Booking, { user: { id: user.id } })) return 0;

  const checkIn = daysFromToday(-3);
  const checkOut = daysFromToday(-1);
  await manager.insert(Booking, {
    user,
    room,
    checkIn,
    checkOut,
    totalPrice: room.pricePerNight * countNights(checkIn, checkOut),
    status: BookingStatus.APPROVED,
    note: 'Seed: kỳ nghỉ đã kết thúc, chờ hoàn tất',
  });
  return 1;
}
