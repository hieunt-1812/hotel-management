import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Refresh token của thiết bị này, sẽ bị thu hồi',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  refreshToken?: string;
}
