import { BookingStatus } from './entities/booking.entity';

/** Bookings in these states hold the room; rejected/cancelled ones free it. */
export const ROOM_BLOCKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
];

export const BOOKING_COMPLETION_JOB = 'complete-finished-bookings';

export const BOOKING_COMPLETION_DEFAULT_CRON = '0 1 * * *';
