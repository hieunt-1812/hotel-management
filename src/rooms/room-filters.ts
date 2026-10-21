import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { Room } from './entities/room.entity';
import { ROOM_BLOCKING_STATUSES } from '../bookings/entities/booking.entity';
import { RoomSort, SearchRoomsQueryDto } from './dto/search-rooms-query.dto';
import { assertValidStay } from '../common/utils/stay-dates.util';

const SORT_COLUMNS: Record<RoomSort, [string, 'ASC' | 'DESC']> = {
  [RoomSort.NEWEST]: ['room.createdAt', 'DESC'],
  [RoomSort.PRICE_ASC]: ['room.pricePerNight', 'ASC'],
  [RoomSort.PRICE_DESC]: ['room.pricePerNight', 'DESC'],
};

/** Cross-field checks that class-validator can't express on a single property. */
export function validateRoomSearch(query: SearchRoomsQueryDto) {
  const { checkIn, checkOut, minPrice, maxPrice } = query;
  if (!checkIn !== !checkOut) {
    throw new BadRequestException('Cần nhập cả checkIn và checkOut');
  }
  if (checkIn && checkOut) assertValidStay(checkIn, checkOut);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new BadRequestException('minPrice không được lớn hơn maxPrice');
  }
}

/**
 * Adds the room search filters + sort to a query builder aliased `room`.
 * Shared by the room list and (later) the admin Excel export.
 */
export function applyRoomFilters(
  qb: SelectQueryBuilder<Room>,
  query: SearchRoomsQueryDto,
): SelectQueryBuilder<Room> {
  const { checkIn, checkOut, amenities, bedType, view, capacity } = query;
  const { roomTypeId, minPrice, maxPrice, sort } = query;

  if (checkIn && checkOut) {
    // Available = no blocking booking overlapping [checkIn, checkOut).
    // Back-to-back stays are fine: a booking ending on checkIn does not overlap.
    qb.andWhere(
      `NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.room_id = room.id
          AND b.status IN (:...blockingStatuses)
          AND b.check_in < :checkOut
          AND b.check_out > :checkIn
      )`,
      { checkIn, checkOut, blockingStatuses: ROOM_BLOCKING_STATUSES },
    );
  }

  if (amenities?.length) {
    // Room must have ALL requested amenities
    qb.andWhere(
      `room.id IN (
        SELECT ra.room_id FROM room_amenities ra
        JOIN amenities a ON a.id = ra.amenity_id
        WHERE a.name IN (:...amenities)
        GROUP BY ra.room_id
        HAVING COUNT(DISTINCT a.id) = :amenityCount
      )`,
      { amenities, amenityCount: amenities.length },
    );
  }

  if (bedType) qb.andWhere('room.bedType = :bedType', { bedType });
  if (view) qb.andWhere('room.view = :view', { view });
  if (capacity) qb.andWhere('room.capacity >= :capacity', { capacity });
  if (roomTypeId) {
    qb.andWhere('room.room_type_id = :roomTypeId', { roomTypeId });
  }
  if (minPrice !== undefined) {
    qb.andWhere('room.pricePerNight >= :minPrice', { minPrice });
  }
  if (maxPrice !== undefined) {
    qb.andWhere('room.pricePerNight <= :maxPrice', { maxPrice });
  }

  const [column, direction] = SORT_COLUMNS[sort];
  // Tie-break on id so pages stay stable when sort values are equal
  return qb.orderBy(column, direction).addOrderBy('room.id', 'ASC');
}
