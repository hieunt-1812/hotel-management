import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { Redis } from 'ioredis';

const KEY_PREFIX = 'activate_';
const DEFAULT_TTL_HOURS = 24;

/**
 * One-time, expiring account activation tokens stored in Redis.
 * Only the SHA-256 hash is stored, so a Redis dump cannot be used to activate accounts.
 */
@Injectable()
export class ActivationTokenService {
  readonly ttlHours: number;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    configService: ConfigService,
  ) {
    this.ttlHours =
      Number(configService.get('ACTIVATION_TOKEN_TTL_HOURS')) ||
      DEFAULT_TTL_HOURS;
  }

  async issue(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.redisClient.set(
      this.key(token),
      userId,
      'EX',
      this.ttlHours * 3600,
    );
    return token;
  }

  /** Returns the userId and deletes the token atomically, or null if invalid/expired. */
  async consume(token: string): Promise<string | null> {
    return this.redisClient.getdel(this.key(token));
  }

  private key(token: string) {
    return KEY_PREFIX + createHash('sha256').update(token).digest('hex');
  }
}
