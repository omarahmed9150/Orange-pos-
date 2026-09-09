import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { BackupService } from './backup.service';

@ApiTags('Telegram Backup')
@ApiBearerAuth()
@Controller('backup')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('run-now')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'تشغيل نسخة احتياطية فورية للمستخدم الحالي (لأغراض الاختبار)' })
  async runNow(@CurrentUser() actor: AuthenticatedUser) {
    const [user, settings] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: actor.userId } }),
      this.prisma.storeSettings.findFirst({ where: { storeId: actor.storeId } }),
    ]);
    if (!user || !settings?.telegramChatId) {
      return { message: 'يجب ربط حساب تليغرام أولاً من صفحة الإعدادات' };
    }
    await this.backupService.backupForUser(user.id, settings.telegramChatId, user.fullName, actor.storeId);
    return { message: 'تم إرسال النسخة الاحتياطية إلى تليغرام' };
  }
}
