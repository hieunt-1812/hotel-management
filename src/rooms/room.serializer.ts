import { Room } from './entities/room.entity';
import { Review } from '../reviews/entities/review.entity';

/** Public room shape: hides timestamps/soft-delete and flattens relations. */
export function serializeRoom(room: Room) {
  return {
    id: room.id,
    name: room.name,
    pricePerNight: room.pricePerNight,
    capacity: room.capacity,
    bedType: room.bedType,
    view: room.view,
    description: room.description,
    roomType: room.roomType
      ? { id: room.roomType.id, name: room.roomType.name }
      : null,
    amenities: (room.amenities ?? []).map((a) => a.name).sort(),
    images: (room.images ?? []).map((image) => image.url),
  };
}

/** Public review shape: only the reviewer's name, never their email/phone. */
export function serializeReview(review: Review) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    reviewer: review.booking?.user?.fullName ?? null,
  };
}

/** Admin room shape: image ids (needed to delete images) and timestamps. */
export function serializeAdminRoom(room: Room) {
  return {
    ...serializeRoom(room),
    images: (room.images ?? []).map(({ id, url }) => ({ id, url })),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}
