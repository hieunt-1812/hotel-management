import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from './entities/payment.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { serializePayment } from './payment.serializer';

@Injectable()
export class PaymentsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async pay(userId: string, bookingId: string, method: PaymentMethod) {
    const payment = await this.dataSource.transaction(async (manager) => {
      const booking = await manager
        .createQueryBuilder(Booking, 'booking')
        .innerJoin('booking.user', 'user')
        .select([
          'booking.id',
          'booking.status',
          'booking.totalPrice',
          'user.id',
        ])
        .where('booking.id = :bookingId', { bookingId })
        .setLock('pessimistic_write', undefined, ['booking'])
        .getOne();
      if (!booking) throw new NotFoundException('Không tìm thấy booking');
      if (booking.user.id !== userId) {
        throw new ForbiddenException(
          'Bạn không thể thanh toán booking của người khác',
        );
      }
      if (booking.status !== BookingStatus.APPROVED) {
        throw new ConflictException(
          `Chỉ thanh toán được booking đã duyệt (hiện tại: ${booking.status})`,
        );
      }

      const alreadyPaid = await manager.existsBy(Payment, {
        booking: { id: bookingId },
        status: PaymentStatus.PAID,
      });
      if (alreadyPaid) {
        throw new ConflictException('Booking đã được thanh toán');
      }

      const { identifiers } = await manager.insert(Payment, {
        booking: { id: bookingId },
        amount: booking.totalPrice,
        method,
        status: PaymentStatus.PAID,
        paidAt: () => 'now()',
      });
      return manager.findOneOrFail(Payment, {
        where: { id: identifiers[0].id as string },
        relations: { booking: true },
      });
    });

    return serializePayment(payment);
  }
}
