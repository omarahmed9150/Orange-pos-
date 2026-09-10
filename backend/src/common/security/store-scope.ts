import { UnauthorizedException } from '@nestjs/common';

// أي قيمة قديمة كانت تُستخدم كـ "افتراضية مشتركة" بين المتاجر تُعتبر الآن غير صالحة صراحة،
// حتى لو بقيت موجودة بصفوف قديمة بقاعدة البيانات - عشان تتفعّل آلية الإصلاح الذاتي بـ JwtStrategy
const RESERVED_STORE_IDS = new Set(['default-store', 'singleton', 'null', 'undefined', '']);

export function isValidStoreId(storeId: unknown): storeId is string {
  return typeof storeId === 'string'
    && storeId.trim() !== ''
    && !RESERVED_STORE_IDS.has(storeId.trim());
}

export function assertStoreId(storeId: string | null | undefined): asserts storeId is string {
  if (!isValidStoreId(storeId)) {
    throw new UnauthorizedException('معرف المتجر غير صالح');
  }
}