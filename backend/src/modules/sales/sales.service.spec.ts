import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentMethod, RefundStatus, ShiftStatus, UserRole } from '@prisma/client';
import { SalesService } from './sales.service';
import { createPrismaMock, createAuditMock } from '../../test-utils/prisma-mock';

describe('SalesService', () => {
  let service: SalesService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let audit: ReturnType<typeof createAuditMock>;

  const openShift = { id: 'shift-1', status: ShiftStatus.OPEN, cashierId: 'user-1' };
  const variant = {
    id: 'variant-1',
    sellingPrice: 100,
    wholesalePrice: 80,
    vipPrice: 70,
    stockQuantity: 10,
    product: { name: 'T-Shirt' },
    size: 'M',
    color: 'Black',
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = createAuditMock();
    prisma.variant.updateMany.mockResolvedValue({ count: 1 });
    prisma.saleItem.updateMany.mockResolvedValue({ count: 1 });
    prisma.shift.findUnique.mockResolvedValue(openShift);
    service = new SalesService(prisma, audit as any);
  });

  describe('create', () => {
    it('يرفض فاتورة بلا أصناف', async () => {
      await expect(service.create({ items: [], shiftId: 'shift-1', paymentMethod: PaymentMethod.CASH } as any, 'user-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('يرفض البيع بالدين بدون تحديد عميل', async () => {
      await expect(
        service.create(
          { items: [{ variantId: 'variant-1', quantity: 1 }], shiftId: 'shift-1', paymentMethod: PaymentMethod.DEBT } as any,
          'user-1',
        ),
      ).rejects.toThrow('البيع بالدين يتطلب اختيار عميل');
    });

    it('يرفض البيع على وردية غير موجودة', async () => {
      prisma.shift.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create({ items: [{ variantId: 'variant-1', quantity: 1 }], shiftId: 'shift-x', paymentMethod: PaymentMethod.CASH } as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('يرفض البيع على وردية مغلقة', async () => {
      prisma.shift.findUnique.mockResolvedValueOnce({ id: 'shift-1', status: ShiftStatus.CLOSED });
      await expect(
        service.create({ items: [{ variantId: 'variant-1', quantity: 1 }], shiftId: 'shift-1', paymentMethod: PaymentMethod.CASH } as any, 'user-1'),
      ).rejects.toThrow('Cannot create sale on a closed shift');
    });

    it('يرفض البيع عند نقص المخزون', async () => {
      prisma.shift.findUnique.mockResolvedValueOnce(openShift);
      prisma.variant.findMany.mockResolvedValueOnce([{ ...variant, stockQuantity: 1 }]);
      prisma.variant.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.create({ items: [{ variantId: 'variant-1', quantity: 5 }], shiftId: 'shift-1', paymentMethod: PaymentMethod.CASH } as any, 'user-1'),
      ).rejects.toThrow(/المخزون غير كاف/);
    });

    it('يخصم المخزون بالكمية الصحيحة ويحسب الإجمالي مع الخصم والضريبة', async () => {
      prisma.shift.findUnique.mockResolvedValueOnce(openShift);
      prisma.variant.findMany.mockResolvedValueOnce([variant]);
      prisma.sale.create.mockResolvedValueOnce({ id: 'sale-1' });

      await service.create(
        {
          items: [{ variantId: 'variant-1', quantity: 2 }],
          shiftId: 'shift-1',
          paymentMethod: PaymentMethod.CASH,
          discount: 20,
          tax: 10,
        } as any,
        'user-1',
      );

      // التحقق من خصم المخزون بالكمية الصحيحة
      expect(prisma.variant.updateMany).toHaveBeenCalledWith({
        where: { id: 'variant-1', stockQuantity: { gte: 2 } },
        data: { stockQuantity: { decrement: 2 } },
      });

      // الإجمالي: (100*2) - 20 خصم + 10 ضريبة = 190
      const createCall = prisma.sale.create.mock.calls[0][0];
      expect(createCall.data.totalAmount).toBe(190);
      expect(audit.log).toHaveBeenCalledWith('user-1', 'SALE_CREATED', 'Sale', 'sale-1', expect.any(Object));
    });

    it('يستخدم سعر الجملة عند تحديد priceTier=WHOLESALE', async () => {
      prisma.shift.findUnique.mockResolvedValueOnce(openShift);
      prisma.variant.findMany.mockResolvedValueOnce([variant]);
      prisma.sale.create.mockResolvedValueOnce({ id: 'sale-2' });

      await service.create(
        {
          items: [{ variantId: 'variant-1', quantity: 1, priceTier: 'WHOLESALE' }],
          shiftId: 'shift-1',
          paymentMethod: PaymentMethod.CASH,
        } as any,
        'user-1',
      );

      const createCall = prisma.sale.create.mock.calls[0][0];
      expect(createCall.data.totalAmount).toBe(80); // سعر الجملة وليس المفرد
    });
  });

  describe('refund', () => {
    const saleWithItems = {
      id: 'sale-1',
      refundStatus: RefundStatus.NONE,
      items: [{ id: 'item-1', variantId: 'variant-1', quantity: 3, refundedQty: 0, price: 100 }],
    };

    it('يرفض الاسترجاع لفاتورة مسترجعة بالكامل مسبقاً', async () => {
      prisma.sale.findUnique.mockResolvedValueOnce({ ...saleWithItems, refundStatus: RefundStatus.FULL });
      await expect(service.refund('sale-1', {}, { userId: 'u1', username: 'admin' })).rejects.toThrow(
        'تم استرجاع هذه الفاتورة بالكامل مسبقاً',
      );
    });

    it('يرفض استرجاع كمية أكبر من المتبقي', async () => {
      prisma.sale.findUnique.mockResolvedValueOnce(saleWithItems);
      await expect(
        service.refund('sale-1', { items: [{ saleItemId: 'item-1', quantity: 10 }] }, { userId: 'u1', username: 'admin' }),
      ).rejects.toThrow(/لا يمكن استرجاع كمية أكبر/);
    });

    it('الاسترجاع الكامل الافتراضي (بدون تحديد أصناف) يُعيد كل الكمية ويُحدّث الحالة FULL', async () => {
      prisma.sale.findUnique.mockResolvedValueOnce(saleWithItems);
      prisma.saleItem.findMany.mockResolvedValueOnce([{ id: 'item-1', quantity: 3, refundedQty: 3 }]);
      prisma.sale.findUnique.mockResolvedValueOnce({ ...saleWithItems, refundStatus: RefundStatus.FULL });

      await service.refund('sale-1', {}, { userId: 'u1', username: 'admin' });

      expect(prisma.variant.update).toHaveBeenCalledWith({
        where: { id: 'variant-1' },
        data: { stockQuantity: { increment: 3 } },
      });
      expect(prisma.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ refundStatus: RefundStatus.FULL }),
        }),
      );
    });

    it('الاسترجاع الجزئي يُحدّث الحالة PARTIAL فقط', async () => {
      prisma.sale.findUnique.mockResolvedValueOnce(saleWithItems);
      prisma.saleItem.findMany.mockResolvedValueOnce([{ id: 'item-1', quantity: 3, refundedQty: 1 }]);
      prisma.sale.findUnique.mockResolvedValueOnce({ ...saleWithItems, refundStatus: RefundStatus.PARTIAL });

      await service.refund('sale-1', { items: [{ saleItemId: 'item-1', quantity: 1 }] }, { userId: 'u1', username: 'admin' });

      expect(prisma.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ refundStatus: RefundStatus.PARTIAL }),
        }),
      );
    });
  });

  describe('exchange - حساب فرق السعر', () => {
    const originalSale = {
      id: 'sale-1',
      refundStatus: RefundStatus.NONE,
      items: [{ id: 'item-1', variantId: 'variant-1', quantity: 1, refundedQty: 0, price: 100 }],
    };
    const cheaperVariant = { ...variant, id: 'variant-2', sellingPrice: 60 };
    const pricierVariant = { ...variant, id: 'variant-3', sellingPrice: 150 };

    it('يحسب amountDue عندما يكون الصنف الجديد أغلى من المُرجَع', async () => {
      prisma.sale.findUnique.mockResolvedValueOnce(originalSale);
      prisma.variant.findMany.mockResolvedValueOnce([pricierVariant]);
      prisma.saleItem.findMany.mockResolvedValueOnce([{ id: 'item-1', quantity: 1, refundedQty: 1 }]);
      prisma.sale.create.mockResolvedValueOnce({ id: 'sale-new' });
      prisma.sale.findUnique.mockResolvedValueOnce({ id: 'sale-new' }); // finalNewSale
      prisma.sale.findUnique.mockResolvedValueOnce({ id: 'sale-1' }); // finalOriginalSale

      const result = await service.exchange(
        'sale-1',
        { returnItems: [{ saleItemId: 'item-1', quantity: 1 }], newItems: [{ variantId: 'variant-3', quantity: 1 }], shiftId: 'shift-1' } as any,
        { userId: 'user-1', username: 'admin' },
      );

      // القديم = 100، الجديد = 150 -> فرق 50 مطلوب من الزبون
      expect(result.priceDifference).toBe(50);
      expect(result.amountDue).toBe(50);
      expect(result.amountToRefundCustomer).toBe(0);
    });

    it('يحسب amountToRefundCustomer عندما يكون الصنف الجديد أرخص من المُرجَع', async () => {
      prisma.sale.findUnique.mockResolvedValueOnce(originalSale);
      prisma.variant.findMany.mockResolvedValueOnce([cheaperVariant]);
      prisma.saleItem.findMany.mockResolvedValueOnce([{ id: 'item-1', quantity: 1, refundedQty: 1 }]);
      prisma.sale.create.mockResolvedValueOnce({ id: 'sale-new' });
      prisma.sale.findUnique.mockResolvedValueOnce({ id: 'sale-new' });
      prisma.sale.findUnique.mockResolvedValueOnce({ id: 'sale-1' });

      const result = await service.exchange(
        'sale-1',
        { returnItems: [{ saleItemId: 'item-1', quantity: 1 }], newItems: [{ variantId: 'variant-2', quantity: 1 }], shiftId: 'shift-1' } as any,
        { userId: 'user-1', username: 'admin' },
      );

      // القديم = 100، الجديد = 60 -> يُرجَع 40 للزبون
      expect(result.priceDifference).toBe(-40);
      expect(result.amountDue).toBe(0);
      expect(result.amountToRefundCustomer).toBe(40);
    });

    it('يرفض الاستبدال لصنف بديل بلا مخزون كافٍ', async () => {
      prisma.sale.findUnique.mockResolvedValueOnce(originalSale);
      prisma.variant.findMany.mockResolvedValueOnce([{ ...pricierVariant, stockQuantity: 0 }]);

      await expect(
        service.exchange(
          'sale-1',
          { returnItems: [{ saleItemId: 'item-1', quantity: 1 }], newItems: [{ variantId: 'variant-3', quantity: 1 }], shiftId: 'shift-1' } as any,
          { userId: 'user-1', username: 'admin' },
        ),
      ).rejects.toThrow(/المخزون غير كافٍ/);
    });
  });
});
