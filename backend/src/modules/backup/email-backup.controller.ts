import { Controller, Post, Body, UseGuards, Get, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmailBackupService } from './email-backup.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Response } from 'express';

@ApiTags('Backup')
@ApiBearerAuth()
@Controller('backup/email')
export class EmailBackupController {
  constructor(private readonly emailBackupService: EmailBackupService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check if email backup is configured' })
  getStatus() {
    return { configured: this.emailBackupService.isConfigured() };
  }

  @Post('send')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send a backup via email' })
  async sendBackupEmail(
    @Body('email') email: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!email) {
      return { success: false, message: 'Email address is required' };
    }
    return this.emailBackupService.sendBackupEmail(email, user.userId, user.storeId);
  }

  @Get('download')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'تنزيل نسخة Excel محلياً عند تعذر البريد' })
  async downloadBackup(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const { buffer, fileName } = await this.emailBackupService.buildDownloadBackup(user.userId, user.storeId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
