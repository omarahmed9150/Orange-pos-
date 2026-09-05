import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { DatabaseBackupService } from './database-backup.service';
import { DatabaseBackupController } from './database-backup.controller';
import { EmailBackupService } from './email-backup.service';
import { EmailBackupController } from './email-backup.controller';

@Module({
  imports: [TelegramModule, StoreSettingsModule],
  providers: [BackupService, DatabaseBackupService, EmailBackupService],
  controllers: [BackupController, DatabaseBackupController, EmailBackupController],
})
export class BackupModule {}
