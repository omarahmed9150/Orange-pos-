import { Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { TelegramService } from './telegram.service';

@ApiTags('Telegram Backup')
@ApiBearerAuth()
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Post('link-token')
  @ApiOperation({ summary: 'توليد رابط ربط تليغرام (Deep Link) خاص بالمستخدم الحالي' })
  async createLink(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.telegram.generateLinkToken(user.userId);
    return { ...result, botConfigured: this.telegram.isConfigured() };
  }

  @Delete('link')
  @ApiOperation({ summary: 'إلغاء ربط حساب تليغرام للمستخدم الحالي' })
  async unlink(@CurrentUser() user: AuthenticatedUser) {
    await this.telegram.unlink(user.userId);
    return { message: 'تم إلغاء الربط' };
  }

  @Post('verify-token')
  @ApiOperation({ summary: 'التحقق المباشر من توكن Telegram' })
  verifyToken(@Body('token') token: string) {
    return this.telegram.verifyToken(token);
  }
}
