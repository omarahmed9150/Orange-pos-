import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { QuickSwitchDto } from './dto/quick-switch.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });

    // رسالة موحدة لعدم كشف إن كان اسم المستخدم صحيحاً أم لا
    const invalidCredentials = () =>
      new UnauthorizedException('اسم المستخدم أو كلمة السر غير صحيحة');

    if (!user) throw invalidCredentials();
    if (!user.isActive) throw new UnauthorizedException('هذا الحساب محظور');

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw invalidCredentials();

    const payload = { sub: user.id, username: user.username, role: user.role, storeId: user.storeId };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        storeId: user.storeId,
      },
    };
  }

  /** تعيين/تغيير PIN الخاص بالمستخدم الحالي - يتطلب تأكيد كلمة السر لأمان إضافي */
  async setPin(userId: string, dto: SetPinDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('المستخدم غير موجود');

    const passwordOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordOk) throw new BadRequestException('كلمة السر الحالية غير صحيحة');

    const pinHash = await bcrypt.hash(dto.pin, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { pinHash } });

    return { message: 'تم تعيين PIN بنجاح' };
  }

  /** يتحقق من PIN للمستخدم الحالي (المصادق عليه أصلاً) - يُستخدم لإلغاء قفل الشاشة لنفس المستخدم */
  async verifyPin(userId: string, dto: VerifyPinDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.pinHash) {
      throw new BadRequestException('لم يتم تعيين PIN لهذا الحساب بعد');
    }
    const valid = await bcrypt.compare(dto.pin, user.pinHash);
    if (!valid) throw new UnauthorizedException('PIN غير صحيح');
    return { valid: true };
  }

  /** تبديل سريع لمستخدم آخر عبر اسم المستخدم + PIN (بدون كلمة السر الكاملة) - لتبديل الكاشير بسرعة على نفس الجهاز */
  async quickSwitch(dto: QuickSwitchDto) {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });

    const invalid = () => new UnauthorizedException('اسم المستخدم أو PIN غير صحيح');

    if (!user) throw invalid();
    if (!user.isActive) throw new UnauthorizedException('هذا الحساب محظور');
    if (!user.pinHash) throw new BadRequestException('لم يتم تعيين PIN لهذا الحساب بعد');

    const pinOk = await bcrypt.compare(dto.pin, user.pinHash);
    if (!pinOk) throw invalid();

    const payload = { sub: user.id, username: user.username, role: user.role, storeId: user.storeId };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        storeId: user.storeId,
      },
    };
  }
}
