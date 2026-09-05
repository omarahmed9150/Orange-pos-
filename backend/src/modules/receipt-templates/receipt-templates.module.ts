import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ReceiptTemplatesService } from './receipt-templates.service';
import { ReceiptTemplatesController } from './receipt-templates.controller';

@Module({
  imports: [AuditModule],
  providers: [ReceiptTemplatesService],
  controllers: [ReceiptTemplatesController],
})
export class ReceiptTemplatesModule {}
