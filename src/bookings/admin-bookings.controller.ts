import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminListBookingsQueryDto } from './dto/admin-list-bookings-query.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';

@ApiTags('Admin - Bookings')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
@ApiResponse({ status: 403, description: 'Không phải admin.' })
@Controller('admin/bookings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminBookingsController {
  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách booking (lọc, phân trang)' })
  findAll(@Query() query: AdminListBookingsQueryDto) {
    return this.adminBookingsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết booking' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy booking.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminBookingsService.findOne(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Xác nhận booking (gửi mail cho khách)' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy booking.' })
  @ApiResponse({ status: 409, description: 'Booking không còn pending.' })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminBookingsService.approve(id);
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Hoàn tất booking đã duyệt và đã qua ngày trả phòng',
  })
  @ApiResponse({ status: 400, description: 'Chưa tới ngày trả phòng.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy booking.' })
  @ApiResponse({
    status: 409,
    description: 'Booking không ở trạng thái approved.',
  })
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminBookingsService.complete(id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Từ chối booking, bắt buộc có lý do (gửi mail)' })
  @ApiResponse({ status: 400, description: 'Thiếu lý do từ chối.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy booking.' })
  @ApiResponse({ status: 409, description: 'Booking không còn pending.' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { reason }: RejectBookingDto,
  ) {
    return this.adminBookingsService.reject(id, reason);
  }
}
