import { IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RoomFiltersQueryDto } from './room-filters-query.dto';

export class SearchRoomsQueryDto extends IntersectionType(
  PaginationQueryDto,
  RoomFiltersQueryDto,
) {}
