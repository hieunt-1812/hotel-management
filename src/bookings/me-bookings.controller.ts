import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
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
import { BookingsService } from './bookings.service';
import { MyBookingsQueryDto } from './dto/my-bookings-query.dto';

/** Booking history of the logged-in user. */
@ApiTags('Bookings')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
@Controller('me/bookings')
@UseGuards(AuthGuard('jwt'))
export class MeBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'Lịch sử booking của tôi (lọc, phân trang)' })
  findMine(@Request() req: any, @Query() query: MyBookingsQueryDto) {
    return this.bookingsService.findMine(req.user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết booking của tôi' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy booking.' })
  findOne(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.findMineById(req.user.id, id);
  }
}
