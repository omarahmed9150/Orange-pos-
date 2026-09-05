import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class QuickUpdateVariantDto {
  @ApiPropertyOptional({ description: 'سعر البيع الجديد' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional({ description: 'الكمية الجديدة' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;
}
