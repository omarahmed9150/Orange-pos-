import { UnauthorizedException } from '@nestjs/common';

export function assertStoreId(storeId: string | null | undefined): asserts storeId is string {
  if (!storeId || storeId === 'null' || storeId === 'undefined') {
    throw new UnauthorizedException('معرف المتجر غير صالح');
  }
}
