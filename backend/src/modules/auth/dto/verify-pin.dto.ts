import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyPinDto {
  @ApiProperty({ example: '1234' })
  @IsString()
  pin: string;
}
