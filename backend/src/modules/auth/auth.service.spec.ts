import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let jwt: { signAsync: jest.Mock };

  let passwordHash: string;
  let pinHash: string;

  const baseUser = {
    id: 'user-1',
    username: 'cashier1',
    fullName: 'أحمد',
    role: UserRole.CASHIER,
    isActive: true,
    storeId: 'store-1',
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('CorrectPass123', 10);
    pinHash = await bcrypt.hash('1234', 10);
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-jwt-token') };
    service = new AuthService(prisma, jwt as any);
  });

  describe('login', () => {
    it('يرفض اسم مستخدم غير موجود برسالة موحّدة (لا يكشف السبب)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.login({ username: 'nobody', password: 'x' })).rejects.toThrow(
        'اسم المستخدم أو كلمة السر غير صحيحة',
      );
    });

    it('يرفض حساباً محظوراً', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, isActive: false, passwordHash });
      await expect(service.login({ username: 'cashier1', password: 'CorrectPass123' })).rejects.toThrow(
        'هذا الحساب محظور',
      );
    });

    it('يرفض كلمة سر خاطئة', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, passwordHash });
      await expect(service.login({ username: 'cashier1', password: 'WrongPass' })).rejects.toThrow(UnauthorizedException);
    });

    it('ينجح بكلمة سر صحيحة ويُرجع توكن وبيانات المستخدم فقط (بدون كلمة السر)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, passwordHash });
      const result = await service.login({ username: 'cashier1', password: 'CorrectPass123' });

      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user).toEqual({
        id: 'user-1',
        username: 'cashier1',
        fullName: 'أحمد',
        role: UserRole.CASHIER,
        storeId: 'store-1',
      });
      expect((result.user as any).passwordHash).toBeUndefined();
    });
  });

  describe('setPin', () => {
    it('يرفض تعيين PIN بكلمة سر حالية خاطئة', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, passwordHash });
      await expect(service.setPin('user-1', { currentPassword: 'wrong', pin: '1234' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ينجح بكلمة سر صحيحة ويحفظ PIN مشفّراً', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, passwordHash });
      const result = await service.setPin('user-1', { currentPassword: 'CorrectPass123', pin: '5678' });

      expect(result.message).toBe('تم تعيين PIN بنجاح');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
    });
  });

  describe('verifyPin', () => {
    it('يرفض إن لم يوجد PIN مضبوط أصلاً', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, pinHash: null });
      await expect(service.verifyPin('user-1', { pin: '1234' })).rejects.toThrow(
        'لم يتم تعيين PIN لهذا الحساب بعد',
      );
    });

    it('يرفض PIN غير صحيح', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, pinHash });
      await expect(service.verifyPin('user-1', { pin: '9999' })).rejects.toThrow(UnauthorizedException);
    });

    it('ينجح بـ PIN صحيح', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, pinHash });
      const result = await service.verifyPin('user-1', { pin: '1234' });
      expect(result.valid).toBe(true);
    });
  });

  describe('quickSwitch', () => {
    it('يرفض مستخدماً غير موجود', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.quickSwitch({ username: 'nobody', pin: '1234' })).rejects.toThrow(
        'اسم المستخدم أو PIN غير صحيح',
      );
    });

    it('يرفض حساباً محظوراً حتى لو كان الـ PIN صحيحاً', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, isActive: false, pinHash });
      await expect(service.quickSwitch({ username: 'cashier1', pin: '1234' })).rejects.toThrow('هذا الحساب محظور');
    });

    it('يرفض PIN خاطئاً', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, pinHash });
      await expect(service.quickSwitch({ username: 'cashier1', pin: '0000' })).rejects.toThrow(
        'اسم المستخدم أو PIN غير صحيح',
      );
    });

    it('ينجح بـ PIN صحيح ويُرجع توكن جديد', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, pinHash });
      const result = await service.quickSwitch({ username: 'cashier1', pin: '1234' });
      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user.username).toBe('cashier1');
    });
  });
});
