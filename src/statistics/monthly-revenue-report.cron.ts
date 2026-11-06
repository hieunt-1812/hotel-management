import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { MonthlyRevenueReportService } from './monthly-revenue-report.service';
import {
  MONTHLY_REVENUE_REPORT_DEFAULT_CRON,
  MONTHLY_REVENUE_REPORT_JOB,
} from './statistics.constants';
import { isLastDayOfMonth, toLocalMonth } from './statistics-periods.util';

@Injectable()
export class MonthlyRevenueReportCron implements OnModuleInit {
  private readonly logger = new Logger(MonthlyRevenueReportCron.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
    private readonly reportService: MonthlyRevenueReportService,
  ) {}

  onModuleInit() {
    const schedule =
      this.configService.get<string>('MONTHLY_REVENUE_REPORT_CRON') ||
      MONTHLY_REVENUE_REPORT_DEFAULT_CRON;
    const job = new CronJob(schedule, () => this.run());
    this.schedulerRegistry.addCronJob(MONTHLY_REVENUE_REPORT_JOB, job);
    job.start();
    this.logger.log(
      `Scheduled "${MONTHLY_REVENUE_REPORT_JOB}" at "${schedule}"`,
    );
  }

  async run(now = new Date()) {
    if (!isLastDayOfMonth(now)) return;
    try {
      const { month, recipients } = await this.reportService.sendReport(
        toLocalMonth(now),
      );
      this.logger.log(
        `Queued revenue report of ${month} for ${recipients} admins`,
      );
    } catch (error) {
      this.logger.error('Failed to send monthly revenue report', error);
    }
  }
}
