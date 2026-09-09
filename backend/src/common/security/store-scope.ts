import { UnauthorizedException } from '@nestjs/common';

export function assertStoreId(storeId: string | null | undefined): asserts storeId is string {
  if (!storeId) {
    throw new UnauthorizedException('معرف المتجر مفقود');
  }
}
