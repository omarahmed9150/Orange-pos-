import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class RefundItemDto {
  @ApiProperty({ description: 'معرّف SaleItem داخل الفاتورة' })
  @IsUUID()
  saleItemId: string;

  @ApiProperty({ example: 1, description: 'الكمية المراد استرجاعها' })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class RefundSaleDto {
  @ApiPropertyOptional({
    type: [RefundItemDto],
    description: 'اتركه فارغاً لاسترجاع الفاتورة بالكامل، أو حدد أصنافاً لاسترجاع جزئي',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundItemDto)
  items?: RefundItemDto[];

  @ApiPropertyOptional({ example: 'المقاس غير مناسب' })
  @IsOptional()
  @IsString()
  reason?: string;
}
