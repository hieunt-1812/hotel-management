import { Booking } from './entities/booking.entity';
import { countNights } from '../common/utils/stay-dates.util';

/** Booking shape returned to its owner. */
export function serializeBooking(booking: Booking) {
  return {
    id: booking.id,
    status: booking.status,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    nights: countNights(booking.checkIn, booking.checkOut),
    totalPrice: booking.totalPrice,
    note: booking.note,
    rejectReason: booking.rejectReason,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    room: booking.room
      ? {
          id: booking.room.id,
          name: booking.room.name,
          pricePerNight: booking.room.pricePerNight,
        }
      : null,
  };
}

/** Booking shape for admins: adds who booked it. */
export function serializeAdminBooking(booking: Booking) {
  const { user } = booking;
  return {
    ...serializeBooking(booking),
    user: user
      ? {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
        }
      : null,
  };
}
