import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import {
  imageUploadOptions,
  MAX_IMAGES_PER_UPLOAD,
} from '../attachments/multer.config';
import { DeleteUploadsOnErrorInterceptor } from '../attachments/interceptors/delete-uploads-on-error.interceptor';
import { AdminRoomsService } from './admin-rooms.service';
import { AdminRoomImagesService } from './admin-room-images.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { SearchRoomsQueryDto } from './dto/search-rooms-query.dto';

const NOT_FOUND = { status: 404, description: 'Không tìm thấy phòng.' };

@ApiTags('Admin - Rooms')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
@ApiResponse({ status: 403, description: 'Không phải admin.' })
@Controller('admin/rooms')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminRoomsController {
  constructor(
    private readonly adminRoomsService: AdminRoomsService,
    private readonly adminRoomImagesService: AdminRoomImagesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Tạo phòng (kèm tiện nghi)' })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu / loại phòng / tiện nghi không hợp lệ.',
  })
  create(@Body() dto: CreateRoomDto) {
    return this.adminRoomsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách phòng (cùng bộ lọc với tìm kiếm phòng)' })
  findAll(@Query() query: SearchRoomsQueryDto) {
    return this.adminRoomsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết phòng' })
  @ApiResponse(NOT_FOUND)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminRoomsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật phòng (amenityIds thay thế toàn bộ)' })
  @ApiResponse(NOT_FOUND)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto) {
    return this.adminRoomsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá mềm phòng' })
  @ApiResponse(NOT_FOUND)
  @ApiResponse({ status: 409, description: 'Phòng còn booking chưa hoàn tất.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminRoomsService.remove(id);
  }

  @Post(':id/images')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('images', MAX_IMAGES_PER_UPLOAD, imageUploadOptions),
    DeleteUploadsOnErrorInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['images'],
      properties: {
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: `Tối đa ${MAX_IMAGES_PER_UPLOAD} ảnh, mỗi ảnh ≤ 2MB`,
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload nhiều ảnh cho phòng' })
  @ApiResponse(NOT_FOUND)
  @ApiResponse({
    status: 400,
    description: 'Không có ảnh / sai định dạng / quá số lượng.',
  })
  @ApiResponse({ status: 413, description: 'Ảnh lớn hơn 2MB.' })
  addImages(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.adminRoomImagesService.add(id, files);
  }

  @Delete(':id/images/:imageId')
  @ApiOperation({ summary: 'Xoá một ảnh của phòng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng / ảnh.' })
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.adminRoomImagesService.remove(id, imageId);
  }
}
