import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { BedType, RoomView } from '../entities/room.entity';
import { DATE_ONLY_REGEX } from '../../common/utils/stay-dates.util';

export enum RoomSort {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}

export class SearchRoomsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Ngày nhận phòng (YYYY-MM-DD), dùng cùng checkOut',
  })
  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'checkIn phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true })
  checkIn?: string;

  @ApiPropertyOptional({
    example: '2026-11-03',
    description: 'Ngày trả phòng (YYYY-MM-DD), phải sau checkIn',
  })
  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'checkOut phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true })
  checkOut?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'air_conditioner,wifi',
    description: 'Phòng phải có TẤT CẢ tiện nghi này (phân cách bằng dấu phẩy)',
  })
  @IsOptional()
  // "a, b,,a" -> ['a', 'b']
  @Transform(({ value }) =>
    typeof value === 'string'
      ? [
          ...new Set(
            value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ]
      : value,
  )
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ enum: BedType })
  @IsOptional()
  @IsEnum(BedType)
  bedType?: BedType;

  @ApiPropertyOptional({ enum: RoomView })
  @IsOptional()
  @IsEnum(RoomView)
  view?: RoomView;

  @ApiPropertyOptional({ example: 2, description: 'Số khách tối thiểu' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 2000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: RoomSort, default: RoomSort.NEWEST })
  @IsOptional()
  @IsEnum(RoomSort)
  sort: RoomSort = RoomSort.NEWEST;
}
