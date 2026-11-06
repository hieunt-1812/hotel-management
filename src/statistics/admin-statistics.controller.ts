import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
import { BookingStatisticsService } from './booking-statistics.service';
import { RevenueStatisticsService } from './revenue-statistics.service';
import { MonthlyRevenueReportService } from './monthly-revenue-report.service';
import { BookingStatisticsQueryDto } from './dto/booking-statistics-query.dto';
import { RevenueStatisticsQueryDto } from './dto/revenue-statistics-query.dto';
import { MonthlyRevenueReportDto } from './dto/monthly-revenue-report.dto';
import { toLocalMonth } from './statistics-periods.util';

@ApiTags('Admin - Statistics')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
@ApiResponse({ status: 403, description: 'Không phải admin.' })
@Controller('admin/statistics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminStatisticsController {
  constructor(
    private readonly bookingStatisticsService: BookingStatisticsService,
    private readonly revenueStatisticsService: RevenueStatisticsService,
    private readonly monthlyRevenueReportService: MonthlyRevenueReportService,
  ) {}

  @Get('bookings')
  @ApiOperation({
    summary: 'Thống kê số booking theo tháng, quý hoặc loại phòng',
  })
  getBookingStatistics(@Query() query: BookingStatisticsQueryDto) {
    return this.bookingStatisticsService.getStatistics(query);
  }

  @Get('revenue')
  @ApiOperation({
    summary:
      'Thống kê doanh thu đã thanh toán theo ngày, tháng hoặc loại phòng',
  })
  @ApiResponse({ status: 400, description: 'Khoảng thời gian không hợp lệ.' })
  getRevenueStatistics(@Query() query: RevenueStatisticsQueryDto) {
    return this.revenueStatisticsService.getRevenue(query);
  }

  @Post('revenue/monthly-report')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Gửi ngay mail báo cáo doanh thu tháng cho các admin',
  })
  sendMonthlyRevenueReport(@Body() { month }: MonthlyRevenueReportDto) {
    return this.monthlyRevenueReportService.sendReport(
      month ?? toLocalMonth(new Date()),
    );
  }
}
