import { Module } from '@nestjs/common';
import { StoreSettingsModule } from '../store-settings/store-settings.module';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';

@Module({
  imports: [StoreSettingsModule],
  providers: [LicenseService],
  controllers: [LicenseController],
})
export class LicenseModule {}
