import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { PriceTier } from './create-sale.dto';

export class ExchangeReturnItemDto {
  @ApiProperty({ description: 'معرّف SaleItem داخل الفاتورة الأصلية المراد إرجاعه' })
  @IsUUID()
  saleItemId: string;

  @ApiProperty({ example: 1, description: 'الكمية المُرجَعة' })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class ExchangeNewItemDto {
  @ApiProperty()
  @IsUUID()
  variantId: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ enum: PriceTier })
  @IsOptional()
  @IsEnum(PriceTier)
  priceTier?: PriceTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  overridePrice?: number;
}

export class ExchangeSaleDto {
  @ApiProperty({ type: [ExchangeReturnItemDto], description: 'الأصناف المُرجَعة من الفاتورة الأصلية' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExchangeReturnItemDto)
  returnItems: ExchangeReturnItemDto[];

  @ApiProperty({ type: [ExchangeNewItemDto], description: 'الأصناف الجديدة البديلة' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExchangeNewItemDto)
  newItems: ExchangeNewItemDto[];

  @ApiProperty({ description: 'الوردية المفتوحة الحالية (لتسجيل فاتورة الأصناف الجديدة)' })
  @IsUUID()
  shiftId: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH, description: 'طريقة تحصيل فرق السعر إن وُجد' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: 'استبدال مقاس' })
  @IsOptional()
  @IsString()
  reason?: string;
}
