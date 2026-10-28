import { Review } from './entities/review.entity';

export function serializeMyReview(review: Review) {
  return {
    id: review.id,
    bookingId: review.booking?.id,
    rating: review.rating,
    comment: review.comment,
    status: review.status,
    createdAt: review.createdAt,
  };
}

export function serializeAdminReview(review: Review) {
  const { booking, moderatedBy } = review;
  return {
    ...serializeMyReview(review),
    booking: {
      id: booking.id,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
    },
    room: booking.room
      ? { id: booking.room.id, name: booking.room.name }
      : null,
    user: booking.user
      ? {
          id: booking.user.id,
          email: booking.user.email,
          fullName: booking.user.fullName,
        }
      : null,
    moderatedBy: moderatedBy
      ? { id: moderatedBy.id, fullName: moderatedBy.fullName }
      : null,
  };
}
