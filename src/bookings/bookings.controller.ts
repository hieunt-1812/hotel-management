import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
@Controller('bookings')
@UseGuards(AuthGuard('jwt'))
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo request đặt phòng' })
  @ApiResponse({ status: 201, description: 'Tạo booking (pending).' })
  @ApiResponse({ status: 400, description: 'Ngày không hợp lệ.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng.' })
  @ApiResponse({ status: 409, description: 'Phòng đã được đặt trùng ngày.' })
  create(@Request() req: any, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(req.user.id, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Huỷ booking của mình (chỉ khi đang pending)' })
  @ApiResponse({ status: 403, description: 'Không phải booking của bạn.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy booking.' })
  @ApiResponse({ status: 409, description: 'Booking không còn pending.' })
  cancel(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.cancel(req.user.id, id);
  }
}
