import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { Redis } from 'ioredis';
import {
  DEFAULT_REFRESH_TOKEN_TTL_DAYS,
  INVALID_REFRESH_TOKEN_MESSAGE,
  REFRESH_TOKEN_KEY_PREFIX,
  REUSED_REFRESH_TOKEN_MESSAGE,
  USED_REFRESH_TOKEN_KEY_PREFIX,
  USER_REFRESH_TOKENS_KEY_PREFIX,
} from './auth.constants';

@Injectable()
export class RefreshTokenService {
  private readonly ttlSeconds: number;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    configService: ConfigService,
  ) {
    const ttlDays =
      Number(configService.get('REFRESH_TOKEN_TTL_DAYS')) ||
      DEFAULT_REFRESH_TOKEN_TTL_DAYS;
    this.ttlSeconds = ttlDays * 24 * 3600;
  }

  async issue(userId: string): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    const tokenHash = this.hash(token);
    const userKey = USER_REFRESH_TOKENS_KEY_PREFIX + userId;

    await this.redisClient
      .multi()
      .set(REFRESH_TOKEN_KEY_PREFIX + tokenHash, userId, 'EX', this.ttlSeconds)
      .sadd(userKey, tokenHash)
      .expire(userKey, this.ttlSeconds)
      .exec();
    return token;
  }

  async consume(token: string): Promise<string> {
    const tokenHash = this.hash(token);
    const userId = await this.redisClient.getdel(
      REFRESH_TOKEN_KEY_PREFIX + tokenHash,
    );

    if (!userId) {
      const reusedBy = await this.redisClient.get(
        USED_REFRESH_TOKEN_KEY_PREFIX + tokenHash,
      );
      if (reusedBy) {
        await this.revokeAll(reusedBy);
        throw new UnauthorizedException(REUSED_REFRESH_TOKEN_MESSAGE);
      }
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    await this.redisClient
      .multi()
      .set(
        USED_REFRESH_TOKEN_KEY_PREFIX + tokenHash,
        userId,
        'EX',
        this.ttlSeconds,
      )
      .srem(USER_REFRESH_TOKENS_KEY_PREFIX + userId, tokenHash)
      .exec();
    return userId;
  }

  async revoke(token: string, userId: string): Promise<void> {
    const tokenHash = this.hash(token);
    const key = REFRESH_TOKEN_KEY_PREFIX + tokenHash;
    if ((await this.redisClient.get(key)) !== userId) return;

    await this.redisClient
      .multi()
      .del(key)
      .srem(USER_REFRESH_TOKENS_KEY_PREFIX + userId, tokenHash)
      .exec();
  }

  async revokeAll(userId: string): Promise<void> {
    const userKey = USER_REFRESH_TOKENS_KEY_PREFIX + userId;
    const tokenHashes = await this.redisClient.smembers(userKey);
    const keys = tokenHashes.map((hash) => REFRESH_TOKEN_KEY_PREFIX + hash);
    await this.redisClient.del(userKey, ...keys);
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
