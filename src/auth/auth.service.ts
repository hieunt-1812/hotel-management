import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { ActivationTokenService } from './activation-token.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { Redis } from 'ioredis';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly activationTokenService: ActivationTokenService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    const token = await this.activationTokenService.issue(user.id);
    const appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';

    try {
      await this.mailService.sendActivationMail({
        to: user.email,
        fullName: user.fullName,
        activationUrl: `${appUrl}/api/auth/activate?token=${token}`,
        expiresInHours: this.activationTokenService.ttlHours,
      });
    } catch (error) {
      // Account is already persisted; don't fail registration on queue errors
      this.logger.error(
        `Failed to enqueue activation mail for ${user.email}`,
        error,
      );
    }

    return {
      message:
        'Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt tài khoản.',
      user,
    };
  }

  async activate(token: string) {
    const userId = await this.activationTokenService.consume(token);
    const activated = userId ? await this.usersService.activate(userId) : false;
    if (!activated) {
      throw new BadRequestException(
        'Token kích hoạt không hợp lệ hoặc đã hết hạn',
      );
    }
    return { message: 'Kích hoạt tài khoản thành công' };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user)
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    // Account state is checked only after the password, to avoid leaking it to guessers
    if (!user.activatedAt)
      throw new ForbiddenException('Tài khoản chưa được kích hoạt');
    if (!user.isActive) throw new ForbiddenException('Tài khoản đã bị khoá');

    const payload = { email: user.email, sub: user.id };
    const token = this.jwtService.sign(payload);

    return { user: { ...this.usersService.toSafeUser(user), token } };
  }

  async logout(req: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return { message: 'Không tìm thấy token' };
    }

    const token = authHeader.split(' ')[1];
    const decoded: any = this.jwtService.decode(token);

    if (decoded && decoded.exp) {
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0) {
        await this.redisClient.set(
          `bl_${token}`,
          'blacklisted',
          'EX',
          expiresIn,
        );
      }
    }
    return { message: 'Đăng xuất thành công' };
  }
}
