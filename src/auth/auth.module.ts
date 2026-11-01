import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './jwt.strategy';
import { ActivationTokenService } from './activation-token.service';
import { MailModule } from '../mail/mail.module';
import { RefreshTokenModule } from './refresh-token.module';
import { DEFAULT_ACCESS_TOKEN_TTL_SECONDS } from './auth.constants';

@Module({
  imports: [
    UsersModule,
    MailModule,
    RefreshTokenModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            Number(configService.get('JWT_ACCESS_TOKEN_TTL_SECONDS')) ||
            DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ActivationTokenService],
})
export class AuthModule {}
