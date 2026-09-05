import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, RefundStatus, ShiftStatus, StockMovementType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { PriceTier } from './dto/create-sale.dto';
import { RefundSaleDto } from './dto/refund-sale.dto';
import { ExchangeSaleDto } from './dto/exchange-sale.dto';

/** يحدد السعر الفعلي للصنف بحسب مستوى السعر المختار، مع رجوع تلقائي لسعر المفرد إن لم يوجد سعر جملة/VIP */
function resolvePrice(variant: { sellingPrice: number; wholesalePrice: number | null; vipPrice: number | null }, tier?: PriceTier, overridePrice?: number) {
  if (overridePrice !== undefined) return overridePrice;
  if (tier === PriceTier.WHOLESALE && variant.wholesalePrice) return variant.wholesalePrice;
  if (tier === PriceTier.VIP && variant.vipPrice) return variant.vipPrice;
  return variant.sellingPrice;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateSaleDto, userId: string, storeId = 'default-store') {
    if (!dto.items.length) {
      throw new BadRequestException('Sale must contain at least one item');
    }

    if (dto.paymentMethod === PaymentMethod.DEBT && !dto.customerId) {
      throw new BadRequestException('البيع بالدين يتطلب اختيار عميل');
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, storeId } });
      if (!customer) throw new NotFoundException('العميل غير موجود');
    }

    const shift = await this.prisma.shift.findUnique({ where: { id: dto.shiftId } });

    if (!shift || (shift.storeId && shift.storeId !== storeId)) {
      throw new NotFoundException(`Shift ${dto.shiftId} not found`);
    }

    if (shift.status !== ShiftStatus.OPEN) {
      throw new BadRequestException('Cannot create sale on a closed shift');
    }
    if (shift.cashierId !== userId) {
      throw new BadRequestException('لا يمكن تسجيل مبيعات على وردية مستخدم آخر');
    }

    const variantIds = dto.items.map((item) => item.variantId);
    const variants = await this.prisma.variant.findMany({
      where: { id: { in: variantIds }, storeId },
      include: { product: true },
    });

    if (variants.length !== variantIds.length) {
      throw new NotFoundException('One or more variants not found');
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const subtotal = dto.items.reduce((sum, item) => {
      const variant = variantMap.get(item.variantId)!;
      return sum + resolvePrice(variant, item.priceTier as PriceTier, item.overridePrice) * item.quantity;
    }, 0);

    const discount = dto.discount ?? 0;
    const tax = dto.tax ?? 0;
    const totalAmount = Math.max(0, subtotal - discount + tax);

    if (dto.paymentMethod === PaymentMethod.MIXED) {
      const mixedTotal = (dto.cashAmount ?? 0) + (dto.cardAmount ?? 0) + (dto.mobileAmount ?? 0);
      if (Math.abs(mixedTotal - totalAmount) > 0.01) {
        throw new BadRequestException('يجب أن يساوي مجموع دفعات النقد والبطاقة والموبايل إجمالي الفاتورة');
      }
    } else if (dto.cashAmount !== undefined || dto.cardAmount !== undefined || dto.mobileAmount !== undefined) {
      throw new BadRequestException('تفاصيل الدفع المتعدد مسموحة فقط مع طريقة الدفع MIXED');
    }

    if (dto.paymentMethod === PaymentMethod.CASH && dto.paidAmount !== undefined) {
      if (dto.paidAmount < totalAmount) {
        throw new BadRequestException('Paid amount is less than total');
      }
    }

    const sale = await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const updated = await tx.variant.updateMany({
          where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (updated.count !== 1) {
          throw new BadRequestException('المخزون غير كافٍ أو تغيّر أثناء العملية');
        }
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            userId,
            type: StockMovementType.SALE,
            quantity: -item.quantity,
            reason: 'عملية بيع',
          },
        });
      }

      return tx.sale.create({
        data: {
          storeId,
          shiftId: dto.shiftId,
          userId,
          customerId: dto.customerId,
          totalAmount,
          discount,
          tax,
          paidAmount: dto.paymentMethod === PaymentMethod.MIXED ? totalAmount : dto.paidAmount,
          cashAmount: dto.cashAmount,
          cardAmount: dto.cardAmount,
          mobileAmount: dto.mobileAmount,
          paymentMethod: dto.paymentMethod,
          items: {
            create: dto.items.map((item) => {
              const variant = variantMap.get(item.variantId)!;
              return {
                variantId: item.variantId,
                quantity: item.quantity,
                price: resolvePrice(variant, item.priceTier as PriceTier, item.overridePrice),
                unitCostAtSale: variant.costPrice,
              };
            }),
          },
        },
        include: {
          items: { include: { variant: { include: { product: true } } } },
        },
      });
    });

    await this.audit.log(userId, 'SALE_CREATED', 'Sale', sale.id, {
      totalAmount,
      paymentMethod: dto.paymentMethod,
    });

    return sale;
  }

  /**
   * عزل البيانات: الكاشير يرى فواتيره فقط.
   * الأدوار الإدارية (Admin/Manager/SuperAdmin) ترى كل الفواتير.
   */
  findByShift(shiftId: string, requester: { userId: string; role: UserRole }) {
    const isPrivileged = requester.role !== UserRole.CASHIER;
    return this.prisma.sale.findMany({
      where: {
        shiftId,
        ...(isPrivileged ? {} : { userId: requester.userId }),
      },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, requester: { userId: string; role: UserRole }) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { variant: { include: { product: true } } } },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Sale ${id} not found`);
    }

    const isPrivileged = requester.role !== UserRole.CASHIER;
    if (!isPrivileged && sale.userId !== requester.userId) {
      throw new NotFoundException(`Sale ${id} not found`);
    }

    return sale;
  }

  /** استرجاع كامل أو جزئي مع منع تكرار الاسترجاع وإعادة الكمية للمخزون */
  async refund(id: string, dto: RefundSaleDto, actor: { userId: string; username: string }) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    if (sale.refundStatus === RefundStatus.FULL) {
      throw new BadRequestException('تم استرجاع هذه الفاتورة بالكامل مسبقاً');
    }

    const isFullRefund = !dto.items || dto.items.length === 0;

    const itemsToRefund = isFullRefund
      ? sale.items.map((i) => ({ saleItemId: i.id, quantity: i.quantity - i.refundedQty }))
      : dto.items!;

    const requestedByItem = new Map<string, number>();
    for (const req of itemsToRefund) {
      requestedByItem.set(req.saleItemId, (requestedByItem.get(req.saleItemId) ?? 0) + req.quantity);
      const saleItem = sale.items.find((i) => i.id === req.saleItemId);
      if (!saleItem) throw new NotFoundException(`Sale item ${req.saleItemId} not found`);
      const remaining = saleItem.quantity - saleItem.refundedQty;
      if (req.quantity <= 0 || (requestedByItem.get(req.saleItemId) ?? 0) > remaining) {
        throw new BadRequestException(
          `لا يمكن استرجاع كمية أكبر من المتبقي (${remaining}) للصنف ${saleItem.id}`,
        );
      }
    }

    const refundAmount = itemsToRefund.reduce((sum, req) => {
      const saleItem = sale.items.find((i) => i.id === req.saleItemId)!;
      return sum + Number(saleItem.price) * req.quantity;
    }, 0);

    await this.prisma.$transaction(async (tx) => {
      for (const req of itemsToRefund) {
        const saleItem = sale.items.find((i) => i.id === req.saleItemId)!;
        const updatedItem = await tx.saleItem.updateMany({
          where: { id: req.saleItemId, refundedQty: { lte: saleItem.quantity - req.quantity } },
          data: { refundedQty: { increment: req.quantity } },
        });
        if (updatedItem.count !== 1) throw new BadRequestException('تغيرت حالة الاسترجاع، أعد المحاولة');
        await tx.variant.update({
          where: { id: saleItem.variantId },
          data: { stockQuantity: { increment: req.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            variantId: saleItem.variantId,
            userId: actor.userId,
            type: StockMovementType.REFUND,
            quantity: req.quantity,
            reason: 'استرجاع فاتورة',
          },
        });
      }

      const updatedItems = await tx.saleItem.findMany({ where: { saleId: id } });
      const fullyRefunded = updatedItems.every((i) => i.refundedQty >= i.quantity);

      await tx.sale.update({
        where: { id },
        data: {
          refundStatus: fullyRefunded ? RefundStatus.FULL : RefundStatus.PARTIAL,
          refundedAt: new Date(),
          refundedBy: actor.username,
          refundReason: dto.reason,
        },
      });
    });

    await this.audit.log(actor.userId, 'SALE_REFUNDED', 'Sale', id, {
      isFullRefund,
      refundAmount,
      reason: dto.reason,
    });

    return this.prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
  }

  /**
   * الاستبدال: يرجّع أصنافاً من فاتورة أصلية ويستبدلها بأصناف جديدة في فاتورة منفصلة،
   * مع حساب فرق السعر تلقائياً (المبلغ المطلوب من الزبون أو المبلغ الواجب إرجاعه له).
   */
  async exchange(id: string, dto: ExchangeSaleDto, actor: { userId: string; username: string }) {
    const originalSale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!originalSale) throw new NotFoundException(`Sale ${id} not found`);
    const exchangeShift = await this.prisma.shift.findUnique({ where: { id: dto.shiftId } });
    if (!exchangeShift || exchangeShift.cashierId !== actor.userId || exchangeShift.status !== ShiftStatus.OPEN) {
      throw new BadRequestException('الوردية غير صالحة أو لا تملكها');
    }
    if (originalSale.refundStatus === RefundStatus.FULL) {
      throw new BadRequestException('تم استرجاع هذه الفاتورة بالكامل مسبقاً - لا يمكن الاستبدال منها');
    }
    if (!dto.returnItems.length) {
      throw new BadRequestException('يجب تحديد صنف واحد على الأقل للإرجاع ضمن عملية الاستبدال');
    }
    if (!dto.newItems.length) {
      throw new BadRequestException('يجب تحديد صنف واحد على الأقل كبديل');
    }

    // تحقق الأصناف المُرجَعة (نفس منطق refund)
    const requestedReturns = new Map<string, number>();
    for (const req of dto.returnItems) {
      requestedReturns.set(req.saleItemId, (requestedReturns.get(req.saleItemId) ?? 0) + req.quantity);
      const saleItem = originalSale.items.find((i) => i.id === req.saleItemId);
      if (!saleItem) throw new NotFoundException(`Sale item ${req.saleItemId} not found`);
      const remaining = saleItem.quantity - saleItem.refundedQty;
      if (req.quantity <= 0 || (requestedReturns.get(req.saleItemId) ?? 0) > remaining) {
        throw new BadRequestException(
          `لا يمكن استرجاع كمية أكبر من المتبقي (${remaining}) للصنف ${saleItem.id}`,
        );
      }
    }

    const returnValue = dto.returnItems.reduce((sum, req) => {
      const saleItem = originalSale.items.find((i) => i.id === req.saleItemId)!;
      return sum + Number(saleItem.price) * req.quantity;
    }, 0);

    // تحقق توفر مخزون الأصناف الجديدة
    const newVariantIds = dto.newItems.map((i) => i.variantId);
    const newVariants = await this.prisma.variant.findMany({ where: { id: { in: newVariantIds } } });
    if (newVariants.length !== newVariantIds.length) {
      throw new NotFoundException('صنف بديل غير موجود');
    }
    const newVariantMap = new Map(newVariants.map((v) => [v.id, v]));

    for (const item of dto.newItems) {
      const variant = newVariantMap.get(item.variantId)!;
      if (variant.stockQuantity < item.quantity) {
        throw new BadRequestException(`المخزون غير كافٍ للصنف البديل (المتوفر: ${variant.stockQuantity})`);
      }
    }

    const newValue = dto.newItems.reduce((sum, item) => {
      const variant = newVariantMap.get(item.variantId)!;
      return sum + resolvePrice(variant, item.priceTier as PriceTier, item.overridePrice) * item.quantity;
    }, 0);

    const priceDifference = Math.round((newValue - returnValue) * 100) / 100;
    const amountDue = priceDifference > 0 ? priceDifference : 0;
    const amountToRefundCustomer = priceDifference < 0 ? -priceDifference : 0;

    const newSale = await this.prisma.$transaction(async (tx) => {
      // إرجاع الأصناف القديمة للمخزون وتسجيلها كمسترجعة
      for (const req of dto.returnItems) {
        const saleItem = originalSale.items.find((i) => i.id === req.saleItemId)!;
        const updatedItem = await tx.saleItem.updateMany({
          where: { id: req.saleItemId, refundedQty: { lte: saleItem.quantity - req.quantity } },
          data: { refundedQty: { increment: req.quantity } },
        });
        if (updatedItem.count !== 1) throw new BadRequestException('تغيرت حالة الاسترجاع، أعد المحاولة');
        await tx.variant.update({
          where: { id: saleItem.variantId },
          data: { stockQuantity: { increment: req.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            variantId: saleItem.variantId,
            userId: actor.userId,
            type: StockMovementType.REFUND,
            quantity: req.quantity,
            reason: 'استبدال - إرجاع الصنف القديم',
          },
        });
      }

      const updatedOriginalItems = await tx.saleItem.findMany({ where: { saleId: id } });
      const fullyRefunded = updatedOriginalItems.every((i) => i.refundedQty >= i.quantity);

      await tx.sale.update({
        where: { id },
        data: {
          refundStatus: fullyRefunded ? RefundStatus.FULL : RefundStatus.PARTIAL,
          refundedAt: new Date(),
          refundedBy: actor.username,
          refundReason: dto.reason || 'استبدال',
        },
      });

      // خصم مخزون الأصناف الجديدة وتسجيل فاتورة بديلة
      for (const item of dto.newItems) {
        const updated = await tx.variant.updateMany({
          where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (updated.count !== 1) throw new BadRequestException('المخزون غير كافٍ أو تغيّر أثناء العملية');
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            userId: actor.userId,
            type: StockMovementType.SALE,
            quantity: -item.quantity,
            reason: 'استبدال - صنف بديل',
          },
        });
      }

      return tx.sale.create({
        data: {
          shiftId: dto.shiftId,
          userId: actor.userId,
          totalAmount: newValue,
          discount: Math.min(returnValue, newValue), // الجزء المُغطّى من قيمة الصنف المُرجَع
          paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
          paidAmount: amountDue,
          items: {
            create: dto.newItems.map((item) => {
              const variant = newVariantMap.get(item.variantId)!;
              return {
                variantId: item.variantId,
                quantity: item.quantity,
                price: resolvePrice(variant, item.priceTier as PriceTier, item.overridePrice),
                unitCostAtSale: variant.costPrice,
              };
            }),
          },
        },
        include: { items: true },
      });
    });

    await this.audit.log(actor.userId, 'SALE_EXCHANGED', 'Sale', id, {
      newSaleId: newSale.id,
      returnValue,
      newValue,
      priceDifference,
      reason: dto.reason,
    });

    const finalNewSale = await this.prisma.sale.findUnique({
      where: { id: newSale.id },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });

    const finalOriginalSale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });

    return {
      originalSale: finalOriginalSale,
      newSale: finalNewSale,
      returnValue,
      newValue,
      priceDifference,
      amountDue,
      amountToRefundCustomer,
    };
  }
}
