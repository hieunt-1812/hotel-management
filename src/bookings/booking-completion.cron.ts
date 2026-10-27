import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { BookingCompletionService } from './booking-completion.service';

export const BOOKING_COMPLETION_JOB = 'complete-finished-bookings';
const DEFAULT_SCHEDULE = '0 1 * * *';

@Injectable()
export class BookingCompletionCron implements OnModuleInit {
  private readonly logger = new Logger(BookingCompletionCron.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
    private readonly completionService: BookingCompletionService,
  ) {}

  onModuleInit() {
    const schedule =
      this.configService.get<string>('BOOKING_COMPLETION_CRON') ||
      DEFAULT_SCHEDULE;
    const job = new CronJob(schedule, () => this.run());
    this.schedulerRegistry.addCronJob(BOOKING_COMPLETION_JOB, job);
    job.start();
    this.logger.log(`Scheduled "${BOOKING_COMPLETION_JOB}" at "${schedule}"`);
  }

  async run() {
    try {
      const completed = await this.completionService.completeFinishedBookings();
      this.logger.log(`Completed ${completed} bookings`);
    } catch (error) {
      this.logger.error('Failed to complete finished bookings', error);
    }
  }
}
