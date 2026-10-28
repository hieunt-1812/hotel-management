import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@ApiTags('Reviews')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
@Controller('bookings')
@UseGuards(AuthGuard('jwt'))
export class BookingReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(':id/review')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đánh giá booking đã hoàn tất của mình' })
  @ApiResponse({ status: 201, description: 'Tạo review (chờ admin duyệt).' })
  @ApiResponse({ status: 400, description: 'Rating / comment không hợp lệ.' })
  @ApiResponse({ status: 403, description: 'Không phải booking của bạn.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy booking.' })
  @ApiResponse({
    status: 409,
    description: 'Booking chưa hoàn tất hoặc đã được đánh giá.',
  })
  create(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(req.user.id, id, dto);
  }
}
