import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { today } from '../common/utils/stay-dates.util';

@Injectable()
export class BookingCompletionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async completeFinishedBookings(): Promise<number> {
    const { affected } = await this.dataSource
      .createQueryBuilder()
      .update(Booking)
      .set({ status: BookingStatus.COMPLETED })
      .where('status = :status', { status: BookingStatus.APPROVED })
      .andWhere('check_out <= :today', { today: today() })
      .execute();
    return affected ?? 0;
  }

  async completeOne(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        select: { id: true, status: true, checkOut: true },
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy booking');
      if (booking.status !== BookingStatus.APPROVED) {
        throw new ConflictException(
          `Chỉ hoàn tất được booking đã duyệt (hiện tại: ${booking.status})`,
        );
      }
      if (booking.checkOut > today()) {
        throw new BadRequestException('Booking chưa tới ngày trả phòng');
      }
      await manager.update(Booking, id, { status: BookingStatus.COMPLETED });
    });
  }
}
