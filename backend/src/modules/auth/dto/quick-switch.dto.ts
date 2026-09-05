import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class QuickSwitchDto {
  @ApiProperty({ example: 'cashier1' })
  @IsString()
  username: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  pin: string;
}
