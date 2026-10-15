import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { Redis } from 'ioredis';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'super-secret-key',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const token = req.headers.authorization.split(' ')[1];

    const isBlacklisted = await this.redisClient.get(`bl_${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedException(
        'Token đã bị thu hồi. Vui lòng đăng nhập lại.',
      );
    }

    const user = await this.usersService.findByEmail(payload.email);
    if (!user) throw new UnauthorizedException('User không tồn tại');
    if (!user.isActive) throw new UnauthorizedException('Tài khoản đã bị khoá');

    return this.usersService.toSafeUser(user);
  }
}
