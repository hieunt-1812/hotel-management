import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RoomsService } from './rooms.service';
import { SearchRoomsQueryDto } from './dto/search-rooms-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

/** Public: guests and logged-in users can both browse rooms. */
@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('rooms')
@UseGuards(OptionalJwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách / tìm kiếm phòng (lọc phòng trống, tiện nghi, giá...)',
  })
  @ApiResponse({ status: 400, description: 'Tham số tìm kiếm không hợp lệ.' })
  findAll(@Query() query: SearchRoomsQueryDto) {
    return this.roomsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết phòng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.findOne(id);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Đánh giá đã duyệt của phòng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng.' })
  findReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.roomsService.findReviews(id, query);
  }
}
