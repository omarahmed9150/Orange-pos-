import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BarcodeLabelTemplatesController } from './barcode-label-templates.controller';
import { BarcodeLabelTemplatesService } from './barcode-label-templates.service';

@Module({
  imports: [AuditModule],
  controllers: [BarcodeLabelTemplatesController],
  providers: [BarcodeLabelTemplatesService],
})
export class BarcodeLabelTemplatesModule {}
