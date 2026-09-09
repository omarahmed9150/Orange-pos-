/**
 * Mock مبسّط لـ PrismaService يُستخدم بكل اختبارات الوحدة (Unit Tests) بدل الاتصال بقاعدة بيانات حقيقية.
 * كل دالة هي jest.fn() قابلة لتخصيص قيمة الرجوع (mockResolvedValueOnce) داخل كل اختبار على حدة.
 */
export function createPrismaMock() {
  const model = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  });

  const prisma: any = {
    store: model(),
    user: model(),
    sale: model(),
    saleItem: model(),
    variant: model(),
    product: model(),
    shift: model(),
    customer: model(),
    customerPayment: model(),
    supplier: model(),
    supplierPayment: model(),
    purchaseInvoice: model(),
    stockMovement: model(),
    auditLog: model(),
    storeSettings: model(),
    expense: model(),
    receiptTemplate: model(),
  };

  // $transaction يستدعي الدالة الممرّرة مباشرة مع نفس كائن الـ mock (بدل معاملة قاعدة بيانات حقيقية)
  prisma.$transaction = jest.fn((callback: (tx: any) => any) => callback(prisma));

  return prisma;
}

export function createAuditMock() {
  return { log: jest.fn().mockResolvedValue(undefined), findAll: jest.fn() };
}
