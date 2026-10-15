import {
  Controller,
  Put,
  Body,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { avatarMulterOptions } from '../attachments/multer.config';

@ApiTags('Users')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin User hiện tại' })
  @ApiResponse({ status: 200, description: 'Trả về thông tin user.' })
  @ApiResponse({
    status: 401,
    description: 'Không có quyền truy cập (thiếu hoặc sai Token).',
  })
  getCurrentUser(@Request() req: any) {
    return { user: req.user };
  }

  @Put('user')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('avatar', avatarMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Cập nhật thông tin User (kèm upload avatar tùy chọn)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string', example: 'Nguyen Van A' },
        phone: { type: 'string', example: '0912345678' },
        email: { type: 'string', example: 'john@example.com' },
        password: { type: 'string', example: 'newpassword123' },
        bio: { type: 'string', example: 'I work at Statefarm' },
        image: { type: 'string', example: 'https://example.com/avatar.png' },
        avatar: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Cập nhật user thành công.' })
  @ApiResponse({ status: 401, description: 'Không có quyền truy cập.' })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại.' })
  updateUser(
    @Request() req: any,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.usersService.update(req.user.id, updateUserDto, avatar);
  }
}
