import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierPaymentDto } from './dto/create-payment.dto';

const DEBT_ALERT_DAYS = 30;

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  create(dto: CreateSupplierDto, storeId = 'default-store') {
    return this.prisma.supplier.create({ data: { ...dto, storeId } });
  }

  findAll(storeId = 'default-store') {
    return this.prisma.supplier.findMany({ where: { storeId }, orderBy: { name: 'asc' } });
  }

  /**
   * يحسب الدين المتبقي وتاريخ أقدم فاتورة شراء لم تُغطَّ بعد بالدفعات (تخصيص FIFO)
   * - نفس منطق تنبيه ديون العملاء لكن بالاتجاه المعاكس (نحن مدينون للمورد)
   */
  private async calculateDebtInfo(supplierId: string) {
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'asc' },
    });
    const payments = await this.prisma.supplierPayment.findMany({ where: { supplierId } });

    const totalPurchases = invoices.reduce((s, p) => s + p.totalAmount, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const remainingDebt = Math.max(0, totalPurchases - totalPaid);

    // تخصيص المدفوعات على الفواتير الأقدم أولاً لإيجاد أول فاتورة لم تُسدَّد بالكامل بعد
    let remainingPayments = totalPaid;
    let oldestUnpaidInvoice: (typeof invoices)[number] | null = null;
    for (const invoice of invoices) {
      if (remainingPayments >= invoice.totalAmount) {
        remainingPayments -= invoice.totalAmount;
      } else {
        oldestUnpaidInvoice = invoice;
        break;
      }
    }

    const daysSinceOldestDebt = oldestUnpaidInvoice
      ? Math.floor((Date.now() - new Date(oldestUnpaidInvoice.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      totalPurchases,
      totalPaid,
      remainingDebt: Math.round(remainingDebt * 100) / 100,
      daysSinceOldestDebt,
      isOverdue: remainingDebt > 0 && daysSinceOldestDebt >= DEBT_ALERT_DAYS,
    };
  }

  /** كشف حساب المورد: إجمالي المشتريات - إجمالي المدفوع = الدين المتبقي + معلومات التأخير */
  async getStatement(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        purchaseInvoices: { orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!supplier) throw new NotFoundException('المورد غير موجود');
    const debtInfo = await this.calculateDebtInfo(supplierId);

    return {
      supplier: { id: supplier.id, name: supplier.name, phone: supplier.phone },
      invoices: supplier.purchaseInvoices,
      payments: supplier.payments,
      ...debtInfo,
    };
  }

  /** تنبيه: كل الموردين الذين لهم دين مستحق علينا 30 يوماً فأكثر - تُستخدم بواجهة الموردين */
  async getOverdueDebtAlerts() {
    const suppliers = await this.prisma.supplier.findMany();
    const results = await Promise.all(
      suppliers.map(async (s) => ({ supplier: s, ...(await this.calculateDebtInfo(s.id)) })),
    );
    return results.filter((r) => r.isOverdue);
  }

  async addPayment(supplierId: string, dto: CreateSupplierPaymentDto, userId: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException('المورد غير موجود');

    const payment = await this.prisma.supplierPayment.create({
      data: { supplierId, userId, amount: dto.amount, notes: dto.notes },
    });

    await this.audit.log(userId, 'SUPPLIER_PAYMENT_ADDED', 'Supplier', supplierId, { amount: dto.amount });
    return payment;
  }
}
