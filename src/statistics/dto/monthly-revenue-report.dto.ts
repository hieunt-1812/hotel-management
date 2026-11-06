import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { MONTH_REGEX } from '../statistics.constants';

export class MonthlyRevenueReportDto {
  @ApiPropertyOptional({
    example: '2026-11',
    description: 'Tháng cần gửi báo cáo, mặc định tháng hiện tại',
  })
  @IsOptional()
  @Matches(MONTH_REGEX, { message: 'month phải có dạng YYYY-MM' })
  month?: string;
}
