import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseShiftDto {
  @ApiProperty({ example: 1250.5, description: 'Actual cash counted in drawer' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  actualCash: number;

  @ApiPropertyOptional({ example: 'End of day - no discrepancies' })
  @IsString()
  @IsOptional()
  notes?: string;
}
