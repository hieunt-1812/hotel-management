import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { Room } from '../rooms/entities/room.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { UpdateBookingDto } from './dto/update-booking.dto';
import {
  BOOKING_EDITABLE_STATUSES,
  EMPTY_BOOKING_UPDATE_MESSAGE,
  PAID_BOOKING_STAY_CHANGE_MESSAGE,
  ROOM_TAKEN_MESSAGE,
} from './booking.constants';
import {
  calculateTotalPrice,
  hasOverlappingBooking,
} from './booking-stay.util';
import { assertValidStay } from '../common/utils/stay-dates.util';
import { AdminBookingsService } from './admin-bookings.service';
import { serializeAdminBooking } from './booking.serializer';
import { MailService } from '../mail/mail.service';
import { BookingMailDetails } from '../mail/mail.constants';

@Injectable()
export class AdminBookingUpdateService {
  private readonly logger = new Logger(AdminBookingUpdateService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly adminBookingsService: AdminBookingsService,
    private readonly mailService: MailService,
  ) {}

  async update(id: string, dto: UpdateBookingDto) {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException(EMPTY_BOOKING_UPDATE_MESSAGE);
    }

    const { previous, current } = await this.dataSource.transaction((manager) =>
      this.applyUpdate(manager, id, dto),
    );

    const booking = await this.adminBookingsService.findWithGuest(id);
    if (this.hasChanged(previous, current)) {
      await this.notifyGuest(booking, previous, current);
    }
    return serializeAdminBooking(booking);
  }

  private async applyUpdate(
    manager: EntityManager,
    id: string,
    dto: UpdateBookingDto,
  ) {
    const booking = await this.lockBooking(manager, id);
    const roomId = dto.roomId ?? booking.room.id;
    const checkIn = dto.checkIn ?? booking.checkIn;
    const checkOut = dto.checkOut ?? booking.checkOut;
    const note = dto.note ?? booking.note;
    const stayChanged =
      roomId !== booking.room.id ||
      checkIn !== booking.checkIn ||
      checkOut !== booking.checkOut;

    let room = booking.room;
    let totalPrice = booking.totalPrice;
    if (stayChanged) {
      assertValidStay(checkIn, checkOut);
      await this.assertNotPaid(manager, id);
      room = await this.lockRoom(manager, roomId);
      if (
        await hasOverlappingBooking(manager, { roomId, checkIn, checkOut }, id)
      ) {
        throw new ConflictException(ROOM_TAKEN_MESSAGE);
      }
      totalPrice = calculateTotalPrice(room.pricePerNight, checkIn, checkOut);
    }

    await manager.update(Booking, id, {
      room: { id: room.id },
      checkIn,
      checkOut,
      totalPrice,
      note,
    });

    return {
      previous: this.toMailDetails(booking),
      current: { roomName: room.name, checkIn, checkOut, totalPrice, note },
    };
  }

  private async lockBooking(manager: EntityManager, id: string) {
    const booking = await manager
      .createQueryBuilder(Booking, 'booking')
      .withDeleted()
      .innerJoin('booking.room', 'room')
      .select([
        'booking.id',
        'booking.status',
        'booking.checkIn',
        'booking.checkOut',
        'booking.totalPrice',
        'booking.note',
        'room.id',
        'room.name',
        'room.pricePerNight',
      ])
      .where('booking.id = :id', { id })
      .setLock('pessimistic_write', undefined, ['booking'])
      .getOne();
    if (!booking) throw new NotFoundException('Không tìm thấy booking');
    if (!BOOKING_EDITABLE_STATUSES.includes(booking.status)) {
      throw new ConflictException(
        `Chỉ sửa được booking đang chờ duyệt hoặc đã duyệt (hiện tại: ${booking.status})`,
      );
    }
    return booking;
  }

  private async lockRoom(manager: EntityManager, roomId: string) {
    const room = await manager.findOne(Room, {
      select: { id: true, name: true, pricePerNight: true },
      where: { id: roomId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    return room;
  }

  private async assertNotPaid(manager: EntityManager, bookingId: string) {
    const paid = await manager.existsBy(Payment, {
      booking: { id: bookingId },
      status: PaymentStatus.PAID,
    });
    if (paid) throw new ConflictException(PAID_BOOKING_STAY_CHANGE_MESSAGE);
  }

  private toMailDetails(booking: Booking): BookingMailDetails {
    return {
      roomName: booking.room.name,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalPrice: booking.totalPrice,
      note: booking.note,
    };
  }

  private hasChanged(
    previous: BookingMailDetails,
    current: BookingMailDetails,
  ) {
    return (Object.keys(previous) as (keyof BookingMailDetails)[]).some(
      (key) => previous[key] !== current[key],
    );
  }

  private async notifyGuest(
    booking: Booking,
    previous: BookingMailDetails,
    current: BookingMailDetails,
  ) {
    try {
      await this.mailService.sendBookingUpdatedMail({
        to: booking.user.email,
        fullName: booking.user.fullName,
        previous,
        current,
      });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue update mail for booking ${booking.id}`,
        error,
      );
    }
  }
}
