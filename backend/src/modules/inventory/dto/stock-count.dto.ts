import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class StockCountLineDto {
  @ApiProperty()
  @IsUUID()
  variantId: string;

  @ApiProperty({ example: 42, description: 'الكمية الفعلية المعدودة يدوياً' })
  @IsInt()
  @Min(0)
  countedQuantity: number;
}

export class StockCountDto {
  @ApiProperty({ type: [StockCountLineDto], description: 'اترك القائمة بأصناف محددة فقط لجرد جزئي، أو أرسل كل الأصناف لجرد كامل' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => StockCountLineDto)
  lines: StockCountLineDto[];
}
