import {
  Body,
  Controller,
  Get,
  Patch,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { avatarMulterOptions } from '../attachments/multer.config';
import { DeleteUploadsOnErrorInterceptor } from '../attachments/interceptors/delete-uploads-on-error.interceptor';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
@Controller('me')
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Thông tin cá nhân' })
  getProfile(@Request() req: any) {
    // JwtStrategy already loaded the user (without password)
    return req.user;
  }

  @Patch()
  @UseInterceptors(
    FileInterceptor('avatar', avatarMulterOptions),
    DeleteUploadsOnErrorInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cập nhật họ tên, SĐT, avatar (đều tuỳ chọn)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string', example: 'Nguyen Van A' },
        phone: { type: 'string', example: '0912345678' },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'jpg, jpeg, png, gif, webp — tối đa 2MB',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu hoặc file không hợp lệ.' })
  @ApiResponse({ status: 413, description: 'File lớn hơn 2MB.' })
  updateProfile(
    @Request() req: any,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(req.user.id, dto, avatar);
  }

  @Patch('password')
  @ApiOperation({ summary: 'Đổi mật khẩu' })
  @ApiResponse({ status: 200, description: 'Đổi mật khẩu thành công.' })
  @ApiResponse({
    status: 400,
    description: 'Sai mật khẩu hiện tại hoặc mật khẩu mới không hợp lệ.',
  })
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.id, dto);
  }
}
