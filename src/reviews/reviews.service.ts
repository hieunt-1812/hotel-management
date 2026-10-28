import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Review } from './entities/review.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { serializeMyReview } from './review.serializer';

@Injectable()
export class ReviewsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(userId: string, bookingId: string, dto: CreateReviewDto) {
    const review = await this.dataSource.transaction(async (manager) => {
      const booking = await manager
        .createQueryBuilder(Booking, 'booking')
        .innerJoin('booking.user', 'user')
        .select(['booking.id', 'booking.status', 'user.id'])
        .where('booking.id = :bookingId', { bookingId })
        .setLock('pessimistic_write', undefined, ['booking'])
        .getOne();
      if (!booking) throw new NotFoundException('Không tìm thấy booking');
      if (booking.user.id !== userId) {
        throw new ForbiddenException(
          'Bạn không thể đánh giá booking của người khác',
        );
      }
      if (booking.status !== BookingStatus.COMPLETED) {
        throw new ConflictException(
          `Chỉ đánh giá được booking đã hoàn tất (hiện tại: ${booking.status})`,
        );
      }
      if (await manager.existsBy(Review, { booking: { id: bookingId } })) {
        throw new ConflictException('Booking này đã được đánh giá');
      }

      const { identifiers } = await manager.insert(Review, {
        rating: dto.rating,
        comment: dto.comment || null,
        booking: { id: bookingId },
      });
      return manager.findOneOrFail(Review, {
        select: {
          id: true,
          rating: true,
          comment: true,
          status: true,
          createdAt: true,
          booking: { id: true },
        },
        where: { id: identifiers[0].id as string },
        relations: { booking: true },
      });
    });

    return serializeMyReview(review);
  }
}
