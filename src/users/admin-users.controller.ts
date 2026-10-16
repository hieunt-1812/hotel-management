import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from './entities/user.entity';
import { AdminUsersService } from './admin-users.service';
import { AdminListUsersQueryDto } from './dto/admin-list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
@ApiResponse({ status: 403, description: 'Không phải admin.' })
@Controller('admin/users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách người dùng (tìm kiếm, lọc, phân trang)' })
  findAll(@Query() query: AdminListUsersQueryDto) {
    return this.adminUsersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết người dùng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Khoá / mở khoá người dùng' })
  @ApiResponse({ status: 400, description: 'Admin tự khoá chính mình.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng.' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { isActive }: UpdateUserStatusDto,
    @Request() req: any,
  ) {
    return this.adminUsersService.updateStatus(id, isActive, req.user.id);
  }
}
