import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class SaveBarcodeLabelTemplateDto {
  @ApiProperty({ example: 'القالب الافتراضي للملصقات' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ description: 'إعدادات الملصق كاملة بصيغة JSON' })
  @IsObject()
  config: Record<string, unknown>;
}
