import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import { AppModule } from '../../src/app.module';
import { MAIL_QUEUE } from '../../src/mail/mail.constants';

/**
 * Bull rejects with "Connection is closed" if the app closes while its Redis
 * clients (incl. the processor's blocking client) are still connecting.
 */
export async function waitForQueues(app: INestApplication): Promise<void> {
  const queue = app.get<Queue>(getQueueToken(MAIL_QUEUE));
  await queue.isReady();
  // Processor clients are created asynchronously after the queue is ready
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.all(
    queue.clients.map((client) =>
      client.status === 'ready'
        ? Promise.resolve()
        : new Promise((resolve) => client.once('ready', resolve)),
    ),
  );
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();
  await waitForQueues(app);
  return app;
}
