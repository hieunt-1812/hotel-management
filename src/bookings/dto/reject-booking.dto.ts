import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectBookingDto {
  @ApiProperty({ example: 'Phòng đang bảo trì trong thời gian này' })
  // Trim first so a reason of only spaces counts as empty
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Phải nhập lý do từ chối' })
  @MaxLength(500)
  reason: string;
}
