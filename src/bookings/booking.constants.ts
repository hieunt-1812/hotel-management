import { BookingStatus } from './entities/booking.entity';

/** Bookings in these states hold the room; rejected/cancelled ones free it. */
export const ROOM_BLOCKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
];
