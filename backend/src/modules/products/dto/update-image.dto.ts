import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProductImageDto {
  @ApiPropertyOptional({ description: 'صورة المنتج الجديدة (Base64 data URL)، أو اتركها فارغة للحذف' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
