import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  storeId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (process.env.JWT_SECRET && !process.env.JWT_SECRET.includes('CHANGE_ME')
        ? process.env.JWT_SECRET : (() => {
        throw new Error('JWT_SECRET must be configured');
      })()),
    });
  }

  async validate(payload: JwtPayload) {
    // نتحقق من حالة المستخدم في كل طلب لضمان تفعيل الحظر فوراً
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('الحساب غير موجود أو محظور');
    }
    return { userId: user.id, username: user.username, role: user.role, storeId: user.storeId };
  }
}
