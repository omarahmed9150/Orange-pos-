import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreatePurchaseDto, userId: string, storeId: string) {
    if (!dto.items.length) throw new BadRequestException('يجب إضافة صنف واحد على الأقل');

    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, storeId } });
    if (!supplier) throw new NotFoundException('المورد غير موجود');

    const variantIds = dto.items.map((i) => i.variantId);
    const variants = await this.prisma.variant.findMany({ where: { id: { in: variantIds }, storeId, product: { storeId } } });
    if (variants.length !== variantIds.length) throw new NotFoundException('صنف غير موجود ضمن العناصر');

    const totalAmount = dto.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseInvoice.create({
        data: {
          storeId,
          supplierId: dto.supplierId,
          userId,
          invoiceNo: dto.invoiceNo,
          totalAmount,
          paidAmount: dto.paidAmount ?? 0,
          notes: dto.notes,
          items: {
            create: dto.items.map((i) => ({ storeId, variantId: i.variantId, quantity: i.quantity, unitCost: i.unitCost })),
          },
        },
        include: { items: true },
      });

      for (const item of dto.items) {
        // زيادة المخزون وتحديث سعر التكلفة الحالي بآخر سعر شراء
        await tx.variant.update({
          where: { id: item.variantId, storeId, product: { storeId } },
          data: { stockQuantity: { increment: item.quantity }, costPrice: item.unitCost },
        });

        await tx.stockMovement.create({
          data: {
            storeId,
            variantId: item.variantId,
            userId,
            type: StockMovementType.PURCHASE,
            quantity: item.quantity,
            reason: `فاتورة شراء من ${supplier.name}`,
          },
        });
      }

      if (dto.paidAmount && dto.paidAmount > 0) {
        await tx.supplierPayment.create({
          data: { storeId, supplierId: dto.supplierId, userId, amount: dto.paidAmount, notes: 'دفعة عند استلام الفاتورة' },
        });
      }

      return created;
    });

    await this.audit.log(userId, 'PURCHASE_INVOICE_CREATED', 'PurchaseInvoice', invoice.id, {
      supplierId: dto.supplierId,
      totalAmount,
    });

    return invoice;
  }

  findAll(storeId: string) {
    return this.prisma.purchaseInvoice.findMany({
      where: { storeId, supplier: { storeId }, items: { every: { storeId, variant: { storeId, product: { storeId } } } } },
      include: { supplier: true, items: { where: { storeId, variant: { storeId, product: { storeId } } }, include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
