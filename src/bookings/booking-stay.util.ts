import { EntityManager } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { ROOM_BLOCKING_STATUSES } from './booking.constants';
import { countNights } from '../common/utils/stay-dates.util';

export function hasOverlappingBooking(
  manager: EntityManager,
  stay: { roomId: string; checkIn: string; checkOut: string },
  excludeBookingId?: string,
) {
  const qb = manager
    .createQueryBuilder(Booking, 'booking')
    .where('booking.room_id = :roomId', { roomId: stay.roomId })
    .andWhere('booking.status IN (:...statuses)', {
      statuses: ROOM_BLOCKING_STATUSES,
    })
    .andWhere('booking.checkIn < :checkOut', { checkOut: stay.checkOut })
    .andWhere('booking.checkOut > :checkIn', { checkIn: stay.checkIn });
  if (excludeBookingId) {
    qb.andWhere('booking.id != :excludeBookingId', { excludeBookingId });
  }
  return qb.getExists();
}

export const calculateTotalPrice = (
  pricePerNight: number,
  checkIn: string,
  checkOut: string,
) => Math.round(pricePerNight * countNights(checkIn, checkOut) * 100) / 100;
