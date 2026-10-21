import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { DATE_ONLY_REGEX } from '../../common/utils/stay-dates.util';

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomId: string;

  @ApiProperty({ example: '2026-11-01', description: 'YYYY-MM-DD' })
  @Matches(DATE_ONLY_REGEX, { message: 'checkIn phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true })
  checkIn: string;

  @ApiProperty({
    example: '2026-11-03',
    description: 'YYYY-MM-DD, sau checkIn',
  })
  @Matches(DATE_ONLY_REGEX, { message: 'checkOut phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true })
  checkOut: string;

  @ApiPropertyOptional({ example: 'Cần phòng tầng cao' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
