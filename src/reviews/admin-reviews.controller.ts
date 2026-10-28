import {
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
import { UserRole } from '../users/entities/user.entity';
import { AdminReviewsService } from './admin-reviews.service';
import { AdminListReviewsQueryDto } from './dto/admin-list-reviews-query.dto';

@ApiTags('Admin - Reviews')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
@ApiResponse({ status: 403, description: 'Không phải admin.' })
@Controller('admin/reviews')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách review (lọc theo trạng thái)' })
  findAll(@Query() query: AdminListReviewsQueryDto) {
    return this.adminReviewsService.findAll(query);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Duyệt review (hiển thị ở trang phòng)' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy review.' })
  @ApiResponse({ status: 409, description: 'Review không còn pending.' })
  approve(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminReviewsService.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Từ chối review' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy review.' })
  @ApiResponse({ status: 409, description: 'Review không còn pending.' })
  reject(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminReviewsService.reject(id, req.user.id);
  }
}
