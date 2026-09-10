import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { StoreSettingsService } from './store-settings.service';
import { UpdateStoreSettingsDto } from './dto/update-settings.dto';

@ApiTags('Store Settings')
@Controller('store-settings')
export class StoreSettingsController {
  constructor(private readonly service: StoreSettingsService) {}

  /**
   * معلومات عامة لشاشة الدخول فقط (قبل تسجيل الدخول) - لا تخص أي متجر بعينه ولا تكشف اسم
   * أو بيانات أي متجر حقيقي للعامة. هذا يحل التعارض القديم الذي كان يعرض اسم/بيانات متجر
   * "افتراضي مشترك" لأي زائر لشاشة الدخول قبل حتى تسجيل الدخول.
   */
  @Get('public')
  @Public()
  @ApiOperation({ summary: 'معلومات عامة لشاشة الدخول (اسم التطبيق ولغة الواجهة الافتراضية فقط)' })
  getPublicInfo() {
    return {
      storeName: 'ORANGE POS',
      defaultLanguage: 'ar',
    };
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'عرض إعدادات المتجر الخاصة بالمستخدم الحالي (اسم، عملة، ضريبة، لغة)' })
  async get(@CurrentUser() user: AuthenticatedUser) {
    const settings = await this.service.get(user.storeId);
    const { licenseKey, telegramBotToken, telegramChatId, ...publicSettings } = settings; // لا نُسرّب الأسرار حتى للأدوار غير الإدارية
    return publicSettings;
  }

  @Patch()
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'تعديل إعدادات المحل (يتطلب صلاحية إدارية)' })
  update(@Body() dto: UpdateStoreSettingsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(dto, user.userId);
  }
}