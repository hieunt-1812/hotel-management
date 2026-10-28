import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Review, ReviewStatus } from './entities/review.entity';
import { AdminListReviewsQueryDto } from './dto/admin-list-reviews-query.dto';
import { serializeAdminReview } from './review.serializer';
import { toPaginatedResult } from '../common/utils/paginate.util';

type Decision = ReviewStatus.APPROVED | ReviewStatus.REJECTED;

@Injectable()
export class AdminReviewsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
  ) {}

  async findAll({ status, page, limit }: AdminListReviewsQueryDto) {
    const qb = this.buildQuery()
      .orderBy('review.createdAt', 'DESC')
      .addOrderBy('review.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (status) qb.where('review.status = :status', { status });

    const [reviews, total] = await qb.getManyAndCount();
    return toPaginatedResult(
      [reviews.map(serializeAdminReview), total],
      page,
      limit,
    );
  }

  approve(id: string, adminId: string) {
    return this.moderate(id, adminId, ReviewStatus.APPROVED);
  }

  reject(id: string, adminId: string) {
    return this.moderate(id, adminId, ReviewStatus.REJECTED);
  }

  private async moderate(id: string, adminId: string, status: Decision) {
    await this.dataSource.transaction(async (manager) => {
      const review = await manager.findOne(Review, {
        select: { id: true, status: true },
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!review) throw new NotFoundException('Không tìm thấy review');
      if (review.status !== ReviewStatus.PENDING) {
        throw new ConflictException(
          `Chỉ xử lý được review đang chờ duyệt (hiện tại: ${review.status})`,
        );
      }
      await manager.update(Review, id, {
        status,
        moderatedBy: { id: adminId },
      });
    });

    const review = await this.buildQuery()
      .where('review.id = :id', { id })
      .getOneOrFail();
    return serializeAdminReview(review);
  }

  private buildQuery() {
    return this.reviewsRepository
      .createQueryBuilder('review')
      .innerJoin('review.booking', 'booking')
      .addSelect(['booking.id', 'booking.checkIn', 'booking.checkOut'])
      .innerJoin('booking.room', 'room')
      .addSelect(['room.id', 'room.name'])
      .innerJoin('booking.user', 'user')
      .addSelect(['user.id', 'user.email', 'user.fullName'])
      .leftJoin('review.moderatedBy', 'moderator')
      .addSelect(['moderator.id', 'moderator.fullName'])
      .withDeleted();
  }
}
