import { Controller, Get, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
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
  async setupAdmin(@Body() body: { username?: string; password?: string }) {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      throw new BadRequestException('تم إعداد النظام مسبقاً، لا يمكن إنشاء حساب مسؤول جديد عبر هذا المسار');
    }

    const { username, password } = body;
    if (!username?.trim() || !password) {
      throw new BadRequestException('يرجى إدخال اسم المستخدم وكلمة المرور كامليْن');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newAdmin = await this.prisma.user.create({
      data: {
        username: username.trim(),
        fullName: 'المدير العام',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    return {
      success: true,
      message: 'تم إنشاء حساب المسؤول الرئيسي بنجاح',
      userId: newAdmin.id,
    };
  }
}