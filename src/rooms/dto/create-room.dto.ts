import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BedType, RoomView } from '../entities/room.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRoomDto {
  @ApiProperty({ example: 'Room 401' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomTypeId: string;

  @ApiProperty({
    example: 1500000,
    description: 'VND, tối đa 2 chữ số thập phân',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999)
  pricePerNight: number;

  @ApiProperty({ example: 2, description: 'Số khách tối đa' })
  @IsInt()
  @Min(1)
  @Max(20)
  capacity: number;

  @ApiProperty({ enum: BedType })
  @IsEnum(BedType)
  bedType: BedType;

  @ApiProperty({ enum: RoomView })
  @IsEnum(RoomView)
  view: RoomView;

  @ApiPropertyOptional({ example: 'Phòng rộng, view biển' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Danh sách id tiện nghi (thay thế toàn bộ khi cập nhật)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  amenityIds?: string[];
}
