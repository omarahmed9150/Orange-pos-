import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class SetPinDto {
  @ApiProperty({ description: 'كلمة السر الحالية للتأكيد قبل تعيين PIN' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: '1234', description: 'PIN من 4 إلى 6 أرقام' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN يجب أن يكون من 4 إلى 6 أرقام فقط' })
  pin: string;
}
