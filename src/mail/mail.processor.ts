import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { ActivationMailJob, MAIL_JOBS, MAIL_QUEUE } from './mail.constants';
import { buildActivationMail } from './templates/activation-mail.template';

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
    await this.transporter.sendMail({
      from: this.from,
      to: job.data.to,
      ...buildActivationMail(job.data),
    });

    if (!this.smtpEnabled) {
      this.logger.log(
        `Activation link for ${job.data.to}: ${job.data.activationUrl}`,
      );
    }
  }
}
