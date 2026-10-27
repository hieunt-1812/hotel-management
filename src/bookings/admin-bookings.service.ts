import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { AdminListBookingsQueryDto } from './dto/admin-list-bookings-query.dto';
import { buildBookingListQuery } from './booking-list-query';
import { serializeAdminBooking } from './booking.serializer';
import { toPaginatedResult } from '../common/utils/paginate.util';
import { MailService } from '../mail/mail.service';
import { BookingCompletionService } from './booking-completion.service';

type Decision = BookingStatus.APPROVED | BookingStatus.REJECTED;

@Injectable()
export class AdminBookingsService {
  private readonly logger = new Logger(AdminBookingsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    private readonly mailService: MailService,
    private readonly completionService: BookingCompletionService,
  ) {}

  async findAll(query: AdminListBookingsQueryDto) {
    const { page, limit } = query;
    const qb = buildBookingListQuery(this.bookingsRepository, query, {
      withUser: true,
    });
    const [bookings, total] = await qb.getManyAndCount();
    return toPaginatedResult(
      [bookings.map(serializeAdminBooking), total],
      page,
      limit,
    );
  }

  async findOne(id: string) {
    return serializeAdminBooking(await this.loadWithRelations(id));
  }

  approve(id: string) {
    return this.decide(id, BookingStatus.APPROVED);
  }

  reject(id: string, reason: string) {
    return this.decide(id, BookingStatus.REJECTED, reason);
  }

  async complete(id: string) {
    await this.completionService.completeOne(id);
    return serializeAdminBooking(await this.loadWithRelations(id));
  }

  /** State machine: only pending → approved | rejected. Then notify the guest. */
  private async decide(id: string, status: Decision, rejectReason?: string) {
    await this.dataSource.transaction(async (manager) => {
      // Lock the booking row so a concurrent approve/reject/cancel waits and
      // then sees the new status instead of overwriting it
      const booking = await manager.findOne(Booking, {
        select: { id: true, status: true },
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy booking');
      if (booking.status !== BookingStatus.PENDING) {
        throw new ConflictException(
          `Chỉ xử lý được booking đang chờ duyệt (hiện tại: ${booking.status})`,
        );
      }
      await manager.update(Booking, id, {
        status,
        rejectReason: rejectReason ?? null,
      });
    });

    const booking = await this.loadWithRelations(id);
    await this.notifyGuest(booking);
    return serializeAdminBooking(booking);
  }

  /** Mail is queued after commit; a queue error must not undo the decision. */
  private async notifyGuest(booking: Booking) {
    try {
      await this.mailService.sendBookingStatusMail({
        to: booking.user.email,
        fullName: booking.user.fullName,
        roomName: booking.room.name,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalPrice: booking.totalPrice,
        status: booking.status as Decision,
        rejectReason: booking.rejectReason,
      });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue mail for booking ${booking.id}`,
        error,
      );
    }
  }

  private async loadWithRelations(id: string) {
    const booking = await this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoin('booking.user', 'user')
      .addSelect(['user.id', 'user.email', 'user.fullName', 'user.phone'])
      .where('booking.id = :id', { id })
      .withDeleted() // still show bookings of soft-deleted rooms
      .getOne();
    if (!booking) throw new NotFoundException('Không tìm thấy booking');
    return booking;
  }
}
