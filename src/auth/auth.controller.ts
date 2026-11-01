import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiResponse({
    status: 201,
    description: 'Tạo tài khoản thành công, gửi mail kích hoạt.',
  })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại.' })
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Get('activate')
  @ApiOperation({ summary: 'Kích hoạt tài khoản bằng token trong email' })
  @ApiResponse({ status: 200, description: 'Kích hoạt thành công.' })
  @ApiResponse({
    status: 400,
    description: 'Token không hợp lệ hoặc đã hết hạn.',
  })
  activate(@Query() { token }: ActivateAccountDto) {
    return this.authService.activate(token);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiResponse({
    status: 200,
    description:
      'Đăng nhập thành công, trả về access token (30 phút) và refresh token (7 ngày).',
  })
  @ApiResponse({ status: 401, description: 'Sai email hoặc mật khẩu.' })
  @ApiResponse({
    status: 403,
    description: 'Tài khoản chưa kích hoạt hoặc đã bị khoá.',
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cấp lại access token và refresh token mới bằng refresh token',
  })
  @ApiResponse({ status: 200, description: 'Trả về cặp token mới.' })
  @ApiResponse({
    status: 401,
    description:
      'Refresh token không hợp lệ, đã hết hạn, đã bị thu hồi hoặc bị dùng lại.',
  })
  refresh(@Body() { refreshToken }: RefreshTokenDto) {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng xuất, thu hồi access token và refresh token gửi kèm',
  })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công.' })
  logout(@Request() req: any, @Body() { refreshToken }: LogoutDto) {
    return this.authService.logout(req, refreshToken);
  }
}
