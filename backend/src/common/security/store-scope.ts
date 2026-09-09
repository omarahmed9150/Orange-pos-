import { UnauthorizedException } from '@nestjs/common';

export function isValidStoreId(storeId: unknown): storeId is string {
  return typeof storeId === 'string'
    && storeId.trim() !== ''
    && storeId !== 'null'
    && storeId !== 'undefined';
}

export function assertStoreId(storeId: string | null | undefined): asserts storeId is string {
  if (!isValidStoreId(storeId)) {
    throw new UnauthorizedException('معرف المتجر غير صالح');
  }
}
