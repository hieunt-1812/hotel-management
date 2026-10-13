import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateAccountDto {
  @ApiProperty({ description: 'Activation token sent by email' })
  @IsNotEmpty()
  @IsString()
  token: string;
}
