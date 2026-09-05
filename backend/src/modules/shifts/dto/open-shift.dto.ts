import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenShiftDto {
  @ApiProperty({ example: 200.0, description: 'Initial cash in drawer at shift start' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  initialCash: number;

  @ApiPropertyOptional({ example: 'Morning shift - register 1' })
  @IsString()
  @IsOptional()
  notes?: string;
}
