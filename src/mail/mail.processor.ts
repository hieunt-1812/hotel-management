import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import {
  ActivationMailJob,
  BookingStatusMailJob,
  MAIL_JOBS,
  MAIL_QUEUE,
} from './mail.constants';
import { buildActivationMail } from './templates/activation-mail.template';
import { buildBookingStatusMail } from './templates/booking-status-mail.template';

/** Consumer side: delivers queued mails via Gmail SMTP (App Password). */
@Processor(MAIL_QUEUE)
export class MailProcessor {
  private readonly logger = new Logger(MailProcessor.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly smtpEnabled: boolean;

  constructor(configService: ConfigService) {
    const user = configService.get<string>('MAIL_USER');
    const pass = configService.get<string>('MAIL_PASS');
    this.smtpEnabled = Boolean(user && pass);
    this.from = configService.get<string>('MAIL_FROM') || user || 'no-reply';

    // Without SMTP credentials (local dev / tests) mails are rendered but not sent
    this.transporter = this.smtpEnabled
      ? nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
      : nodemailer.createTransport({ jsonTransport: true });

    if (!this.smtpEnabled) {
      this.logger.warn(
        'MAIL_USER/MAIL_PASS not set — mails will be logged only',
      );
    }
  }

  @Process(MAIL_JOBS.ACTIVATION)
  async handleActivation(job: Job<ActivationMailJob>) {
    await this.send(job.data.to, buildActivationMail(job.data));
    if (!this.smtpEnabled) {
      this.logger.log(
        `Activation link for ${job.data.to}: ${job.data.activationUrl}`,
      );
    }
  }

  @Process(MAIL_JOBS.BOOKING_STATUS)
  async handleBookingStatus(job: Job<BookingStatusMailJob>) {
    const mail = buildBookingStatusMail(job.data);
    await this.send(job.data.to, mail);
    if (!this.smtpEnabled) {
      this.logger.log(`Booking mail to ${job.data.to}: ${mail.subject}`);
    }
  }

  private send(
    to: string,
    mail: { subject: string; text: string; html: string },
  ) {
    return this.transporter.sendMail({ from: this.from, to, ...mail });
  }
}
