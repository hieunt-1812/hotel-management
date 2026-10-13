import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ActivationMailJob, MAIL_JOBS, MAIL_QUEUE } from './mail.constants';

/** Producer side: enqueues mail jobs so HTTP requests never wait on SMTP. */
@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue) {}

  async sendActivationMail(data: ActivationMailJob): Promise<void> {
    await this.mailQueue.add(MAIL_JOBS.ACTIVATION, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });
  }
}
