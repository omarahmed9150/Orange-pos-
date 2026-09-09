import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { isValidStoreId } from '../../common/security/store-scope';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  storeId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
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
    const storedUser = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!storedUser || !storedUser.isActive) {
      throw new UnauthorizedException('الحساب غير موجود أو محظور');
    }
    let user: User = storedUser;

    const hadValidTokenStore = isValidStoreId(payload.storeId);
    if (!isValidStoreId(user.storeId)) {
      const storeId = randomUUID();
      user = await this.prisma.$transaction(async (tx) => {
        await tx.store.create({
          data: { id: storeId, name: `${user.fullName || user.username} - متجر` },
        });
        return tx.user.update({ where: { id: user.id }, data: { storeId } });
      });
    }

    const accessToken = !hadValidTokenStore || payload.storeId !== user.storeId
      ? await this.jwt.signAsync({
        sub: user.id,
        username: user.username,
        role: user.role,
        storeId: user.storeId,
      })
      : undefined;

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      storeId: user.storeId,
      ...(accessToken ? { accessToken } : {}),
    };
  }
}
