import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { QuickSwitchDto } from './dto/quick-switch.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 محاولات دخول كحد أقصى كل دقيقة لكل جهاز/IP
  @Post('login')
  @ApiOperation({ summary: 'تسجيل الدخول (حصرياً بحساب أنشأه Super Admin)' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('setup-admin')
  @ApiOperation({ summary: 'إنشاء حساب المسؤول والمتجر الأولي' })
  setupAdmin(@Body() body: { username?: string; password?: string; storeName?: string }) {
    return this.authService.setupAdmin(body.username, body.password, body.storeName);
  }

  @Post('set-pin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تعيين/تغيير PIN الخاص بالمستخدم الحالي (يتطلب كلمة السر الحالية)' })
  setPin(@Body() dto: SetPinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.setPin(user.userId, dto);
  }

  @Post('verify-pin')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 8, ttl: 60_000 } }) // منع تخمين PIN بالمحاولات المتكررة
  @ApiOperation({ summary: 'التحقق من PIN لإلغاء قفل الشاشة لنفس المستخدم الحالي' })
  verifyPin(@Body() dto: VerifyPinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.verifyPin(user.userId, dto);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } }) // منع تخمين PIN بالمحاولات المتكررة
  @Post('quick-switch')
  @ApiOperation({ summary: 'تبديل سريع لمستخدم آخر عبر اسم المستخدم + PIN (بدون كلمة السر الكاملة)' })
  quickSwitch(@Body() dto: QuickSwitchDto) {
    return this.authService.quickSwitch(dto);
  }
}
