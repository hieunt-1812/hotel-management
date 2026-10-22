import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { MyBookingsQueryDto } from './dto/my-bookings-query.dto';

export interface BookingListFilters extends MyBookingsQueryDto {
  userId?: string;
  roomId?: string;
}

/**
 * Paginated booking list query shared by the user's history and the admin list.
 * Joins the room always, and the user (minimal columns) when `withUser` is set.
 * `ownerId` restricts the list to one user's bookings (overrides filters.userId).
 */
export function buildBookingListQuery(
  repository: Repository<Booking>,
  filters: BookingListFilters,
  { withUser = false, ownerId }: { withUser?: boolean; ownerId?: string } = {},
) {
  const { status, from, to, roomId, page, limit } = filters;
  const userId = ownerId ?? filters.userId;
  if (from && to && from > to) {
    throw new BadRequestException('from không được sau to');
  }

  const qb = repository
    .createQueryBuilder('booking')
    .leftJoinAndSelect('booking.room', 'room')
    .orderBy('booking.createdAt', 'DESC')
    .addOrderBy('booking.id', 'ASC')
    .skip((page - 1) * limit)
    .take(limit);

  if (withUser) {
    qb.leftJoin('booking.user', 'user').addSelect([
      'user.id',
      'user.email',
      'user.fullName',
      'user.phone',
    ]);
  }
  if (userId) qb.andWhere('booking.user_id = :userId', { userId });
  if (roomId) qb.andWhere('booking.room_id = :roomId', { roomId });
  if (status) qb.andWhere('booking.status = :status', { status });
  if (from) qb.andWhere('booking.checkIn >= :from', { from });
  if (to) qb.andWhere('booking.checkIn <= :to', { to });
  return qb;
}
