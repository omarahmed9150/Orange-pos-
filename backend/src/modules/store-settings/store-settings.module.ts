import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StoreSettingsService } from './store-settings.service';
import { StoreSettingsController } from './store-settings.controller';

@Module({
  imports: [AuditModule],
  providers: [StoreSettingsService],
  controllers: [StoreSettingsController],
  exports: [StoreSettingsService],
})
export class StoreSettingsModule {}
