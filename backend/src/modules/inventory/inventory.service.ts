import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StockCountDto } from './dto/stock-count.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** تنبيهات: نفاد أو انخفاض المخزون + قرب انتهاء الصلاحية (خلال 15 يوم) + منتهية فعلاً */
  async getAlerts(storeId: string) {
    const now = new Date();
    const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const [allVariants, expiringSoon, expired] = await Promise.all([
      this.prisma.variant.findMany({ where: { storeId, product: { storeId } }, include: { product: true } }),
      this.prisma.variant.findMany({
        where: { storeId, product: { storeId }, expiryDate: { gte: now, lte: in15Days } },
        include: { product: true },
      }),
      this.prisma.variant.findMany({
        where: { storeId, product: { storeId }, expiryDate: { lt: now, not: null } },
        include: { product: true },
      }),
    ]);

    // مقارنة حقلين (stockQuantity <= minStockLevel) غير مدعومة مباشرة في SQLite عبر Prisma -> فلترة يدوية
    const lowStock = allVariants.filter((v) => v.stockQuantity <= v.minStockLevel);

    return { lowStock, expiringSoon, expired };
  }

  /** سجل حركة صنف معيّن (بيع/شراء/جرد/تعديل يدوي) */
  movementHistory(variantId: string, storeId: string) {
    return this.prisma.stockMovement.findMany({
      where: { variantId, storeId, variant: { storeId, product: { storeId } } },
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** جرد كامل أو جزئي: يقارن الكمية المسجّلة بالمعدودة فعلياً ويعدّل الفرق + يسجّل الحركة */
  async applyStockCount(dto: StockCountDto, userId: string, storeId: string) {
    const results: { variantId: string; before: number; after: number; diff: number }[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        const variant = await tx.variant.findFirst({ where: { id: line.variantId, storeId, product: { storeId } } });
        if (!variant) throw new NotFoundException(`Variant ${line.variantId} not found`);

        const diff = line.countedQuantity - variant.stockQuantity;
        if (diff !== 0) {
          const updated = await tx.variant.updateMany({
            where: { id: line.variantId, storeId, product: { storeId }, stockQuantity: variant.stockQuantity },
            data: { stockQuantity: line.countedQuantity },
          });
          if (updated.count !== 1) throw new BadRequestException('تغير المخزون أثناء الجرد، أعد المحاولة');
          await tx.stockMovement.create({
            data: {
              variantId: line.variantId,
              storeId,
              userId,
              type: StockMovementType.COUNT_ADJUSTMENT,
              quantity: diff,
              reason: 'تسوية جرد',
            },
          });
        }
        results.push({ variantId: line.variantId, before: variant.stockQuantity, after: line.countedQuantity, diff });
      }
    });

    await this.audit.log(userId, 'STOCK_COUNT_APPLIED', 'Inventory', undefined, {
      linesCount: dto.lines.length,
      adjustedCount: results.filter((r) => r.diff !== 0).length,
    });

    return results;
  }
}
