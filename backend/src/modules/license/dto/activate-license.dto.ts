import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ActivateLicenseDto {
  @ApiProperty({ example: 'ORANGE-XXXX-XXXX-XXXX-XXXX' })
  @IsString()
  @MinLength(10)
  licenseKey: string;
}
