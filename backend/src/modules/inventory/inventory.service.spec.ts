import { NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { createAuditMock, createPrismaMock } from '../../test-utils/prisma-mock';

describe('InventoryService store isolation', () => {
  it('scopes alerts to the requested store, including the product relation', async () => {
    const prisma = createPrismaMock();
    prisma.variant.findMany.mockResolvedValue([]);
    const service = new InventoryService(prisma, createAuditMock() as any);

    await service.getAlerts('store-a');

    expect(prisma.variant.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { storeId: 'store-a', product: { storeId: 'store-a' } },
    }));
    expect(prisma.variant.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ storeId: 'store-a', product: { storeId: 'store-a' } }),
    }));
    expect(prisma.variant.findMany).toHaveBeenNthCalledWith(3, expect.objectContaining({
      where: expect.objectContaining({ storeId: 'store-a', product: { storeId: 'store-a' } }),
    }));
  });

  it('rejects stock counts for variants outside the requested store', async () => {
    const prisma = createPrismaMock();
    prisma.variant.findFirst.mockResolvedValue(null);
    const service = new InventoryService(prisma, createAuditMock() as any);

    await expect(service.applyStockCount({
      lines: [{ variantId: 'foreign-variant', countedQuantity: 4 }],
    } as any, 'user-a', 'store-a')).rejects.toThrow(NotFoundException);
    expect(prisma.variant.updateMany).not.toHaveBeenCalled();
  });
});
