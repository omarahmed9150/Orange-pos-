import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export enum PriceTier {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
  VIP = 'VIP',
}

export class CreateSaleItemDto {
  @ApiProperty({ example: 'uuid-variant-id' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ enum: PriceTier, required: false, default: PriceTier.RETAIL, description: 'مستوى السعر: مفرد/جملة/VIP' })
  @IsOptional()
  @IsEnum(PriceTier)
  priceTier?: PriceTier;

  @ApiProperty({ required: false, description: 'سعر مخصص لهذا الصنف يتجاوز مستوى السعر (بيع بالوزن مثلاً)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  overridePrice?: number;
}

export class CreateSaleDto {
  @ApiProperty({ example: 'uuid-shift-id' })
  @IsUUID()
  shiftId: string;

  @ApiProperty({ type: [CreateSaleItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  @ApiProperty({ example: 0, required: false })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  discount?: number;

  @ApiProperty({ example: 2.4, required: false })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  tax?: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ example: 50.0, required: false, description: 'Amount paid by customer (cash)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  paidAmount?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cashAmount?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cardAmount?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mobileAmount?: number;

  @ApiProperty({ required: false, description: 'العميل عند البيع بالدين (PaymentMethod = DEBT)' })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
