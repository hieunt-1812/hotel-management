import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { DATE_ONLY_REGEX } from '../../common/utils/stay-dates.util';
import { BookingStatus } from '../entities/booking.entity';

export class MyBookingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Lọc booking có ngày nhận phòng >= from',
  })
  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'from phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Lọc booking có ngày nhận phòng <= to',
  })
  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'to phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true })
  to?: string;
}
