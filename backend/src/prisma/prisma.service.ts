import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

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

      if (orphanVariants.length) {
        await tx.$executeRaw`
          DELETE FROM "stock_movements"
          WHERE "variantId" IN (
            SELECT "id" FROM "variants"
            WHERE "storeId" IS NULL
               OR "productId" IN (SELECT "id" FROM "products" WHERE "storeId" IS NULL)
          )
        `;
        await tx.$executeRaw`
          DELETE FROM "variants"
          WHERE "storeId" IS NULL
             OR "productId" IN (SELECT "id" FROM "products" WHERE "storeId" IS NULL)
        `;
      }
      if (orphanProducts.length) {
        await tx.$executeRaw`DELETE FROM "products" WHERE "storeId" IS NULL`;
      }

      return { products: orphanProducts.length, variants: orphanVariants.length };
    });

    if (removed.products || removed.variants) {
      this.logger.warn(`تم تنظيف بيانات يتيمة: ${removed.products} منتج و${removed.variants} صنف`);
    }
  }
}
