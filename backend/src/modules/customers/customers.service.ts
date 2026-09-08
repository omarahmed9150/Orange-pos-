import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, RefundStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';

const DEBT_ALERT_DAYS = 30;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  create(dto: CreateCustomerDto, storeId: string) {
    return this.prisma.customer.create({ data: { ...dto, storeId } });
  }

  /** بحث سريع بالاسم (يُستخدم عند اختيار العميل في شاشة البيع) مع تنبيه فوري إن كان له دين قديم */
  async search(query: string, storeId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { name: { contains: query }, storeId },
      take: 10,
    });

    return Promise.all(
      customers.map(async (c) => {
        const debtInfo = await this.calculateDebt(c.id, storeId);
        return { ...c, ...debtInfo };
      }),
    );
  }

  findAll(storeId: string) {
    return this.prisma.customer.findMany({ where: { storeId }, orderBy: { name: 'asc' } });
  }

  private async calculateDebt(customerId: string, storeId: string) {
    const sales = await this.prisma.sale.findMany({
      where: { customerId, storeId, paymentMethod: PaymentMethod.DEBT, refundStatus: { not: RefundStatus.FULL } },
      orderBy: { createdAt: 'asc' },
    });
    const payments = await this.prisma.customerPayment.findMany({ where: { customerId, storeId } });

    const totalOwed = sales.reduce((sum, s) => sum + (s.totalAmount - (s.paidAmount ?? 0)), 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingDebt = Math.max(0, totalOwed - totalPaid);

    // أقدم فاتورة دين لم تُسدَّد بعد -> تُستخدم لحساب مدة التأخير
    const oldestUnpaidSale = sales.find((s) => s.totalAmount - (s.paidAmount ?? 0) > 0);
    const daysSinceOldestDebt = oldestUnpaidSale
      ? Math.floor((Date.now() - new Date(oldestUnpaidSale.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      remainingDebt: Math.round(remainingDebt * 100) / 100,
      daysSinceOldestDebt,
      isOverdue: remainingDebt > 0 && daysSinceOldestDebt >= DEBT_ALERT_DAYS,
    };
  }

  async getStatement(customerId: string, storeId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId, storeId },
      include: {
        sales: { where: { storeId }, orderBy: { createdAt: 'desc' } },
        payments: { where: { storeId }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!customer) throw new NotFoundException('العميل غير موجود');

    const debtInfo = await this.calculateDebt(customerId, storeId);
    return { customer, debtInfo };
  }

  async addPayment(customerId: string, dto: CreateCustomerPaymentDto, userId: string, storeId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, storeId } });
    if (!customer) throw new NotFoundException('العميل غير موجود');
    const debt = await this.calculateDebt(customerId, storeId);
    if (dto.amount > debt.remainingDebt) {
      throw new BadRequestException('قيمة الدفعة أكبر من الدين المتبقي');
    }

    const payment = await this.prisma.customerPayment.create({
      data: { customerId, userId, storeId, amount: dto.amount, notes: dto.notes },
    });

    await this.audit.log(userId, 'CUSTOMER_PAYMENT_ADDED', 'Customer', customerId, { amount: dto.amount });
    return payment;
  }

  /** تنبيه: كل العملاء الذين لديهم دين متأخر 30 يوماً فأكثر - تُستخدم في لوحة التحكم */
  async getOverdueDebtAlerts(storeId: string) {
    const customers = await this.prisma.customer.findMany({ where: { storeId } });
    const results = await Promise.all(
      customers.map(async (c) => ({ customer: c, ...(await this.calculateDebt(c.id, storeId)) })),
    );
    return results.filter((r) => r.isOverdue);
  }
}
