import { BookingStatus } from './entities/booking.entity';

/** Bookings in these states hold the room; rejected/cancelled ones free it. */
export const ROOM_BLOCKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
];

export const BOOKING_COMPLETION_JOB = 'complete-finished-bookings';

export const BOOKING_COMPLETION_DEFAULT_CRON = '0 1 * * *';

export const ROOM_TAKEN_MESSAGE = 'Phòng đã có người đặt trong khoảng ngày này';

export const BOOKING_EDITABLE_STATUSES = ROOM_BLOCKING_STATUSES;

export const EMPTY_BOOKING_UPDATE_MESSAGE =
  'Cần ít nhất một thông tin cần thay đổi (roomId, checkIn, checkOut, note)';

export const PAID_BOOKING_STAY_CHANGE_MESSAGE =
  'Booking đã thanh toán, không thể đổi phòng hoặc ngày ở';
