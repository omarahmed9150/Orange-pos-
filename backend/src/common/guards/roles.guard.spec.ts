import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function mockContext(user: { role: UserRole } | null) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('يسمح بالمرور إن لم يكن الـ Endpoint مقيّداً بأي دور', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext({ role: UserRole.CASHIER }))).toBe(true);
  });

  it('يمنع كاشير من الوصول لـ Endpoint مقيّد بـ Admin', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    expect(() => guard.canActivate(mockContext({ role: UserRole.CASHIER }))).toThrow(ForbiddenException);
  });

  it('يمنع الوصول إن لم يوجد مستخدم بالطلب أصلاً', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(mockContext(null))).toThrow(ForbiddenException);
  });

  it('يسمح لـ Admin بالوصول لـ Endpoint مقيّد بـ Admin', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    expect(guard.canActivate(mockContext({ role: UserRole.ADMIN }))).toBe(true);
  });
});
