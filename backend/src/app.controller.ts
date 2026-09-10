import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';
import { AuthService } from './modules/auth/auth.service';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('check-setup')
  @Public()
  @ApiOperation({ summary: 'فحص هل النظام بحاجة لإعداد أولي' })
  async checkSetup() {
    const userCount = await this.prisma.user.count();
    return { needsSetup: userCount === 0 };
  }

  @Post('setup-admin')
  @Public()
  @ApiOperation({ summary: 'إنشاء حساب المسؤول الأولي' })
  async setupAdmin(@Body() body: { username?: string; password?: string; storeName?: string }) {
    return this.authService.setupAdmin(body.username, body.password, body.storeName);
  }
}