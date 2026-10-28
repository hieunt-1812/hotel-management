import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { ReviewsService } from './reviews.service';
import { AdminReviewsService } from './admin-reviews.service';
import { BookingReviewsController } from './booking-reviews.controller';
import { AdminReviewsController } from './admin-reviews.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Review])],
  controllers: [BookingReviewsController, AdminReviewsController],
  providers: [ReviewsService, AdminReviewsService],
  exports: [TypeOrmModule],
})
export class ReviewsModule {}
