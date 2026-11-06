import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AdminStatisticsController } from './admin-statistics.controller';
import { BookingStatisticsService } from './booking-statistics.service';
import { RevenueStatisticsService } from './revenue-statistics.service';
import { MonthlyRevenueReportService } from './monthly-revenue-report.service';
import { MonthlyRevenueReportCron } from './monthly-revenue-report.cron';

@Module({
  imports: [MailModule],
  controllers: [AdminStatisticsController],
  providers: [
    BookingStatisticsService,
    RevenueStatisticsService,
    MonthlyRevenueReportService,
    MonthlyRevenueReportCron,
  ],
})
export class StatisticsModule {}
