import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  ActivationMailJob,
  BookingStatusMailJob,
  MAIL_JOB_OPTIONS,
  MAIL_JOBS,
  MAIL_QUEUE,
  MonthlyRevenueMailJob,
} from './mail.constants';

/** Producer side: enqueues mail jobs so HTTP requests never wait on SMTP. */
@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue) {}

  async sendActivationMail(data: ActivationMailJob): Promise<void> {
    await this.mailQueue.add(MAIL_JOBS.ACTIVATION, data, MAIL_JOB_OPTIONS);
  }

  async sendBookingStatusMail(data: BookingStatusMailJob): Promise<void> {
    await this.mailQueue.add(MAIL_JOBS.BOOKING_STATUS, data, MAIL_JOB_OPTIONS);
  }

  async sendMonthlyRevenueMail(data: MonthlyRevenueMailJob): Promise<void> {
    await this.mailQueue.add(MAIL_JOBS.MONTHLY_REVENUE, data, MAIL_JOB_OPTIONS);
  }
}
