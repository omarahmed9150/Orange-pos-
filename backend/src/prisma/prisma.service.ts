import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Prisma connects lazily when the first query is executed.
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * تطهير كامل لأي بيانات يتيمة (storeId IS NULL) عند كل إقلاع للنظام - يضمن عدم ظهور أي منتج،
   * صنف، أو حركة مخزون لا تنتمي لأي متجر. يُنفَّذ هذا في كل مرة يُقلع فيها التطبيق وليس مرة واحدة فقط،
   * لضمان عدم عودة هذه المشكلة مستقبلاً حتى لو نشأت بيانات يتيمة جديدة بأي طريقة.
   */
  async onApplicationBootstrap() {
    const removed = await this.$transaction(async (tx) => {
      const orphanProducts = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "products" WHERE "storeId" IS NULL
      `;
      const orphanVariants = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "variants"
        WHERE "storeId" IS NULL
           OR "productId" IN (SELECT "id" FROM "products" WHERE "storeId" IS NULL)
      `;
      const orphanMovementsDirect = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "stock_movements" WHERE "storeId" IS NULL
      `;

      // 1) حركات مخزون يتيمة: إمّا storeId فارغ مباشرة على الحركة نفسها، أو مرتبطة بصنف/منتج يتيم
      if (orphanMovementsDirect.length || orphanVariants.length) {
        await tx.$executeRaw`
          DELETE FROM "stock_movements"
          WHERE "storeId" IS NULL
             OR "variantId" IN (
               SELECT "id" FROM "variants"
               WHERE "storeId" IS NULL
                  OR "productId" IN (SELECT "id" FROM "products" WHERE "storeId" IS NULL)
             )
        `;
      }

      // 2) أصناف (variants) يتيمة
      if (orphanVariants.length) {
        await tx.$executeRaw`
          DELETE FROM "variants"
          WHERE "storeId" IS NULL
             OR "productId" IN (SELECT "id" FROM "products" WHERE "storeId" IS NULL)
        `;
      }

      // 3) منتجات يتيمة
      if (orphanProducts.length) {
        await tx.$executeRaw`DELETE FROM "products" WHERE "storeId" IS NULL`;
      }

      return {
        products: orphanProducts.length,
        variants: orphanVariants.length,
        movements: orphanMovementsDirect.length,
      };
    });

    if (removed.products || removed.variants || removed.movements) {
      this.logger.warn(
        `تم تنظيف بيانات يتيمة عند الإقلاع: ${removed.products} منتج، ${removed.variants} صنف، ${removed.movements} حركة مخزون يتيمة مباشرة.`,
      );
    }
  }
}