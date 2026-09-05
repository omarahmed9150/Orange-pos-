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

  @Get()
  @Public() // تُقرأ حتى قبل تسجيل الدخول (لعرض اسم المحل ولغة الواجهة في شاشة الدخول)
  @ApiOperation({ summary: 'عرض إعدادات المحل (اسم، عملة، ضريبة، لغة)' })
  async get() {
    const settings = await this.service.get();
    const { licenseKey, telegramBotToken, telegramChatId, ...publicSettings } = settings; // لا نُسرّب الأسرار عبر المسار العام
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
