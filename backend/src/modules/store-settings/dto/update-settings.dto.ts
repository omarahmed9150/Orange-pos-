import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateStoreSettingsDto {
  @ApiPropertyOptional({ example: 'ORANGE' })
  @IsOptional()
  @IsString()
  storeName?: string;

  @ApiPropertyOptional({ example: 'IQD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  taxEnabled?: boolean;

  @ApiPropertyOptional({ example: 5, description: 'نسبة الضريبة المئوية' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({ enum: ['ar', 'en'] })
  @IsOptional()
  @IsIn(['ar', 'en'])
  defaultLanguage?: string;

  @ApiPropertyOptional({ example: 'D:\\ORANGE-Backups', description: 'مسار مجلد النسخ الاحتياطي المحلي (قرص خارجي أو مجلد مزامنة)' })
  @IsOptional()
  @IsString()
  dbBackupDir?: string;

  @ApiPropertyOptional({ description: 'تفعيل عرض عملة ثانوية (مثال: الدولار) بجانب العملة الأساسية' })
  @IsOptional()
  @IsBoolean()
  secondaryCurrencyEnabled?: boolean;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  secondaryCurrency?: string;

  @ApiPropertyOptional({ example: 1310, description: 'سعر الصرف: كم يساوي 1 من العملة الثانوية بالعملة الأساسية' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  exchangeRate?: number;

  @ApiPropertyOptional({ description: 'توكن بوت Telegram' })
  @IsOptional()
  @IsString()
  telegramBotToken?: string;

  @ApiPropertyOptional({ description: 'معرّف محادثة Telegram للنسخ الاحتياطي' })
  @IsOptional()
  @IsString()
  telegramChatId?: string;
}
