import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './modules/products/products.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { SalesModule } from './modules/sales/sales.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ReceiptTemplatesModule } from './modules/receipt-templates/receipt-templates.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { BackupModule } from './modules/backup/backup.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { StoreSettingsModule } from './modules/store-settings/store-settings.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CustomersModule } from './modules/customers/customers.module';
import { LicenseModule } from './modules/license/license.module';
import { BarcodeLabelTemplatesModule } from './modules/barcode-label-templates/barcode-label-templates.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]), // حد عام مريح لباقي النظام
    PrismaModule,
    AuthModule,
    UsersModule,
    AuditModule,
    ProductsModule,
    ShiftsModule,
    SalesModule,
    ExpensesModule,
    ReceiptTemplatesModule,
    TelegramModule,
    BackupModule,
    SuppliersModule,
    PurchasesModule,
    InventoryModule,
    StoreSettingsModule,
    ReportsModule,
    CustomersModule,
    LicenseModule,
    BarcodeLabelTemplatesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // Rate limiting - يعمل حتى على المسارات العامة (@Public)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
