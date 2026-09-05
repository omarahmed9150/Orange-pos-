import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ReceiptType } from '@prisma/client';

export class SaveTemplateDto {
  @ApiProperty({ example: 'القالب الافتراضي' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: ReceiptType, default: ReceiptType.ALL })
  @IsOptional()
  @IsEnum(ReceiptType)
  appliesTo?: ReceiptType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ description: 'إعدادات التصميم كاملة (JSON)' })
  @IsObject()
  config: Record<string, unknown>;
}
