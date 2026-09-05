import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { createPrismaMock, createAuditMock } from '../../test-utils/prisma-mock';

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

describe('SuppliersService - حساب الدين وتخصيص FIFO', () => {
  let service: SuppliersService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new SuppliersService(prisma, createAuditMock() as any);
  });

  it('يرمي خطأ لمورد غير موجود', async () => {
    prisma.supplier.findUnique.mockResolvedValueOnce(null);
    await expect(service.getStatement('missing')).rejects.toThrow(NotFoundException);
  });

  it('لا يوجد دين متأخر إن كانت كل الفواتير مسدَّدة بالكامل', async () => {
    prisma.supplier.findUnique.mockResolvedValueOnce({ id: 's1', name: 'مورد 1', phone: null });
    prisma.purchaseInvoice.findMany.mockResolvedValueOnce([
      { id: 'inv1', totalAmount: 500, createdAt: daysAgo(40) },
    ]);
    prisma.supplierPayment.findMany.mockResolvedValueOnce([{ amount: 500 }]);

    const result = await service.getStatement('s1');
    expect(result.remainingDebt).toBe(0);
    expect(result.isOverdue).toBe(false);
  });

  it('يعتبر الدين متأخراً فقط بعد 30 يوماً على أقدم فاتورة غير مسدَّدة (تخصيص FIFO)', async () => {
    const invoices = [
      { id: 'old', totalAmount: 300, createdAt: daysAgo(45) }, // مسدَّدة بالكامل عبر FIFO
      { id: 'new', totalAmount: 200, createdAt: daysAgo(10) }, // لم تُسدَّد بعد - حديثة
    ];
    prisma.supplier.findUnique.mockResolvedValueOnce({ id: 's1', name: 'مورد 1', phone: null });
    prisma.purchaseInvoice.findMany.mockResolvedValueOnce(invoices);
    prisma.supplierPayment.findMany.mockResolvedValueOnce([{ amount: 300 }]); // يغطي الفاتورة القديمة فقط

    const result = await service.getStatement('s1');
    expect(result.remainingDebt).toBe(200);
    expect(result.daysSinceOldestDebt).toBeGreaterThanOrEqual(10);
    expect(result.isOverdue).toBe(false); // 10 أيام فقط - أقل من 30
  });

  it('يعتبر الدين متأخراً إن مرّ 30 يوماً فأكثر على أقدم فاتورة غير مسدَّدة', async () => {
    const invoices = [{ id: 'old', totalAmount: 300, createdAt: daysAgo(35) }];
    prisma.supplier.findUnique.mockResolvedValueOnce({ id: 's1', name: 'مورد 1', phone: null });
    prisma.purchaseInvoice.findMany.mockResolvedValueOnce(invoices);
    prisma.supplierPayment.findMany.mockResolvedValueOnce([]); // لا دفعات إطلاقاً

    const result = await service.getStatement('s1');
    expect(result.remainingDebt).toBe(300);
    expect(result.isOverdue).toBe(true);
  });
});
