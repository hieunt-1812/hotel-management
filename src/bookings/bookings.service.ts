import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { ROOM_BLOCKING_STATUSES } from './booking.constants';
import { Room } from '../rooms/entities/room.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { MyBookingsQueryDto } from './dto/my-bookings-query.dto';
import { serializeBooking } from './booking.serializer';
import { toPaginatedResult } from '../common/utils/paginate.util';
import { assertValidStay, countNights } from '../common/utils/stay-dates.util';

@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
  ) {}

  async create(userId: string, dto: CreateBookingDto) {
    const { roomId, checkIn, checkOut, note } = dto;
    assertValidStay(checkIn, checkOut);

    const booking = await this.dataSource.transaction(async (manager) => {
      // Row lock on the room: concurrent bookings for the same room wait here,
      // so the overlap check below always sees the other transaction's insert.
      const room = await manager.findOne(Room, {
        where: { id: roomId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!room) throw new NotFoundException('Không tìm thấy phòng');

      const overlapping = await manager
        .createQueryBuilder(Booking, 'booking')
        .where('booking.room_id = :roomId', { roomId })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: ROOM_BLOCKING_STATUSES,
        })
        .andWhere('booking.checkIn < :checkOut', { checkOut })
        .andWhere('booking.checkOut > :checkIn', { checkIn })
        .getExists();
      if (overlapping) {
        throw new ConflictException(
          'Phòng đã có người đặt trong khoảng ngày này',
        );
      }

      // Price snapshot: computed on the server from the current room price
      const nights = countNights(checkIn, checkOut);
      const totalPrice = Math.round(room.pricePerNight * nights * 100) / 100;

      const saved = await manager.save(
        manager.create(Booking, {
          user: { id: userId },
          room,
          checkIn,
          checkOut,
          totalPrice,
          note: note ?? null,
        }),
      );
      return manager.findOneOrFail(Booking, {
        where: { id: saved.id },
        relations: { room: true },
      });
    });

    return serializeBooking(booking);
  }

  async findMine(userId: string, query: MyBookingsQueryDto) {
    const { status, from, to, page, limit } = query;
    if (from && to && from > to) {
      throw new BadRequestException('from không được sau to');
    }

    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room', 'room')
      .where('booking.user_id = :userId', { userId })
      .orderBy('booking.createdAt', 'DESC')
      .addOrderBy('booking.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (status) qb.andWhere('booking.status = :status', { status });
    if (from) qb.andWhere('booking.checkIn >= :from', { from });
    if (to) qb.andWhere('booking.checkIn <= :to', { to });

    const [bookings, total] = await qb.getManyAndCount();
    return toPaginatedResult(
      [bookings.map(serializeBooking), total],
      page,
      limit,
    );
  }

  async findMineById(userId: string, id: string) {
    // Other users' bookings are reported as not found to avoid leaking them
    const booking = await this.bookingsRepository.findOne({
      where: { id, user: { id: userId } },
      relations: { room: true },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking');
    return serializeBooking(booking);
  }

  /** pending → cancelled, owner only. */
  async cancel(userId: string, id: string) {
    const booking = await this.bookingsRepository.findOne({
      select: { id: true, status: true, user: { id: true } },
      where: { id },
      relations: { user: true },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking');
    if (booking.user.id !== userId) {
      throw new ForbiddenException('Bạn không thể huỷ booking của người khác');
    }

    // Conditional update: safe even if an admin approves at the same moment
    const { affected } = await this.bookingsRepository.update(
      { id, status: BookingStatus.PENDING },
      { status: BookingStatus.CANCELLED },
    );
    if (!affected) {
      throw new ConflictException(
        `Chỉ huỷ được booking đang chờ duyệt (hiện tại: ${booking.status})`,
      );
    }
    return this.findMineById(userId, id);
  }
}
