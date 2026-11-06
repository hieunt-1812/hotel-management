import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { DATE_ONLY_REGEX } from '../../common/utils/stay-dates.util';
import { RevenueGroupBy } from '../statistics.constants';

export class RevenueStatisticsQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Ngày thanh toán từ (mặc định: ngày đầu tháng của to)',
  })
  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'from phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Ngày thanh toán đến, tính cả ngày này (mặc định: hôm nay)',
  })
  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'to phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true })
  to?: string;

  @ApiPropertyOptional({ enum: RevenueGroupBy, default: RevenueGroupBy.DAY })
  @IsOptional()
  @IsEnum(RevenueGroupBy)
  groupBy: RevenueGroupBy = RevenueGroupBy.DAY;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;
}
