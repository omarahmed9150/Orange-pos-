import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateVariantDto {
  @ApiPropertyOptional({ example: 'TSH-BLK-M-001', description: 'Stock keeping unit (generated when omitted)' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ example: '8901234567890', description: 'Barcode for scanner' })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiPropertyOptional({ example: 'M', description: 'Clothing size (optional)' })
  @IsString()
  @IsOptional()
  size?: string;

  @ApiPropertyOptional({ example: 'Black', description: 'Variant color (optional)' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ example: 15.0, description: 'Cost price per unit' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice: number;

  @ApiProperty({ example: 29.99, description: 'Selling price per unit (retail)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice: number;

  @ApiPropertyOptional({ example: 24.99, description: 'سعر الجملة (اختياري)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  wholesalePrice?: number;

  @ApiPropertyOptional({ example: 22.99, description: 'سعر عملاء VIP (اختياري)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  vipPrice?: number;

  @ApiProperty({ example: 50, description: 'Current stock quantity' })
  @IsInt()
  @Min(0)
  stockQuantity: number;

  @ApiPropertyOptional({ example: 5, description: 'Minimum stock alert level (default 5)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minStockLevel?: number;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'تاريخ انتهاء الصلاحية (اختياري - اتركه فارغاً إن لم ينطبق)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'BATCH-2026-01', description: 'رقم التشغيلة (اختياري)' })
  @IsOptional()
  @IsString()
  batchNumber?: string;
}
