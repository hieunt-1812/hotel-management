import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  BookingStatisticsGroupBy,
  MAX_STATISTICS_YEAR,
  MIN_STATISTICS_YEAR,
} from '../statistics.constants';

export class BookingStatisticsQueryDto {
  @ApiPropertyOptional({
    enum: BookingStatisticsGroupBy,
    default: BookingStatisticsGroupBy.MONTH,
  })
  @IsOptional()
  @IsEnum(BookingStatisticsGroupBy)
  groupBy: BookingStatisticsGroupBy = BookingStatisticsGroupBy.MONTH;

  @ApiPropertyOptional({
    example: 2026,
    description: 'Năm tạo booking, mặc định năm hiện tại',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_STATISTICS_YEAR)
  @Max(MAX_STATISTICS_YEAR)
  year: number = new Date().getFullYear();

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;
}
