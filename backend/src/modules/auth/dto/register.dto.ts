import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'shop-owner' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(4)
  password: string;

  @ApiProperty({ example: 'متجر البرتقال' })
  @IsString()
  @MinLength(2)
  storeName: string;
}
