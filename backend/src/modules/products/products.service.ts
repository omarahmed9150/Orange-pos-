import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QuickUpdateVariantDto } from './dto/quick-update-variant.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { StockMovementType } from '@prisma/client';
import { randomUUID } from 'crypto';

const IMPORT_HEADERS = [
  'name', 'category', 'sku', 'barcode', 'size', 'color',
  'costPrice', 'sellingPrice', 'wholesalePrice', 'vipPrice', 'stockQuantity', 'minStockLevel', 'expiryDate',
];

function parseOptionalDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const text = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00.000Z`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  create(dto: CreateProductDto, storeId: string) {
    return this.prisma.product.create({
      data: {
        storeId,
        name: dto.name,
        category: dto.category,
        imageUrl: dto.imageUrl,
        variants: {
          create: dto.variants.map((v) => ({
            ...v,
            storeId,
            sku: v.sku ?? `AUTO-${randomUUID()}`,
            minStockLevel: v.minStockLevel ?? 5,
            expiryDate: parseOptionalDate(v.expiryDate),
          })),
        },
      },
      include: { variants: true },
    });
  }

  async updateImage(id: string, imageUrl: string | null, storeId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, storeId } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);

    return this.prisma.product.update({
      where: { id },
      data: { imageUrl },
      include: { variants: true },
    });
  }

  async update(id: string, dto: UpdateProductDto, userId: string, storeId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, storeId },
      include: { variants: { take: 1 } },
    });
    if (!product || !product.variants[0]) throw new NotFoundException(`Product ${id} not found`);

    const { name, category, imageUrl, barcode, costPrice, sellingPrice, wholesalePrice, vipPrice, stockQuantity } = dto;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
      });
      return tx.variant.update({
        where: { id: product.variants[0].id },
        data: {
          ...(barcode !== undefined ? { barcode } : {}),
          ...(costPrice !== undefined ? { costPrice } : {}),
          ...(sellingPrice !== undefined ? { sellingPrice } : {}),
          ...(wholesalePrice !== undefined ? { wholesalePrice } : {}),
          ...(vipPrice !== undefined ? { vipPrice } : {}),
          ...(stockQuantity !== undefined ? { stockQuantity } : {}),
        },
        include: { product: true },
      });
    });
    await this.audit.log(userId, 'PRODUCT_UPDATED', 'Product', id, { productId: id, variantId: updated.id });
    return this.findOne(id, storeId);
  }

  async remove(id: string, userId: string, storeId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, storeId } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    await this.prisma.product.delete({ where: { id } });
    await this.audit.log(userId, 'PRODUCT_DELETED', 'Product', id, { name: product.name });
    return { deleted: true };
  }

  async quickUpdateVariant(variantId: string, dto: QuickUpdateVariantDto, userId: string, storeId: string) {
    if (dto.sellingPrice === undefined && dto.stockQuantity === undefined) {
      throw new NotFoundException('لم يتم إرسال أي قيمة للتعديل');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const variant = await tx.variant.findFirst({ where: { id: variantId, storeId } });
      if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);

      const data: { sellingPrice?: number; stockQuantity?: number } = {};
      if (dto.sellingPrice !== undefined) data.sellingPrice = dto.sellingPrice;
      if (dto.stockQuantity !== undefined) data.stockQuantity = dto.stockQuantity;

      const updated = await tx.variant.update({
        where: { id: variantId },
        data,
        include: { product: true },
      });

      if (dto.stockQuantity !== undefined && dto.stockQuantity !== variant.stockQuantity) {
        await tx.stockMovement.create({
          data: {
            variantId,
            userId,
            type: StockMovementType.MANUAL_ADJUSTMENT,
            quantity: dto.stockQuantity - variant.stockQuantity,
            reason: 'تعديل سريع من شاشة المنتجات',
          },
        });
      }

      return updated;
    });

    await this.audit.log(userId, 'VARIANT_QUICK_UPDATED', 'Variant', variantId, {
      sellingPrice: dto.sellingPrice,
      stockQuantity: dto.stockQuantity,
    });
    return result;
  }

  findAll(storeId: string) {
    return this.prisma.product.findMany({
      where: { storeId },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  search(query: string, storeId: string) {
    const term = query.trim();
    if (!term) {
      return this.findAll(storeId);
    }

    return this.prisma.product.findMany({
      where: {
        storeId,
        OR: [
          { name: { contains: term } },
          { category: { contains: term } },
          {
            variants: {
              some: {
                OR: [
                  { sku: { contains: term } },
                  { barcode: { contains: term } },
                  { color: { contains: term } },
                  { size: { contains: term } },
                ],
              },
            },
          },
        ],
      },
      include: { variants: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, storeId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id, storeId },
      include: { variants: true },
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  async findByBarcode(barcode: string, storeId: string) {
    const variant = await this.prisma.variant.findFirst({
      where: { barcode, storeId },
      include: { product: true },
    });

    if (!variant) {
      throw new NotFoundException(`Variant with barcode ${barcode} not found`);
    }

    return variant;
  }

  async findBySku(sku: string, storeId: string) {
    const variant = await this.prisma.variant.findFirst({
      where: { sku, storeId },
      include: { product: true },
    });

    if (!variant) {
      throw new NotFoundException(`Variant with SKU ${sku} not found`);
    }

    return variant;
  }

  /**
   * يولّد باركوداً داخلياً فريداً للمنتجات التي لا تملك باركوداً من المصنع (12 رقماً تبدأ بـ 9).
   * لا يتقاطع مع صيغة باركود الميزان الإلكتروني (13 رقماً تبدأ بـ 2) المُستخدَمة بشاشة البيع.
   */
  async generateUniqueBarcode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const randomDigits = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
      const candidate = `9${randomDigits}`;

      const existing = await this.prisma.variant.findUnique({ where: { barcode: candidate } });
      if (!existing) return candidate;
    }
    throw new Error('تعذّر توليد باركود فريد - أعد المحاولة');
  }

  /** يولّد ملف Excel فارغاً بالأعمدة الصحيحة بالضبط - يُستخدم كنموذج لتعبئة بيانات مستوردة من نظام آخر */
  async generateImportTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('المنتجات');

    sheet.columns = IMPORT_HEADERS.map((h) => ({ header: h, key: h, width: 16 }));
    sheet.addRow({
      name: 'قميص قطن', category: 'T-Shirts', sku: 'TSH-BLK-M-001', barcode: '8901234567891',
      size: 'M', color: 'Black', costPrice: 8, sellingPrice: 15, wholesalePrice: 12, vipPrice: 11,
      stockQuantity: 20, minStockLevel: 5, expiryDate: '',
    });

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  /**
   * استيراد جماعي من ملف Excel (.xlsx) - يجمع الصفوف بنفس الاسم+الفئة تحت منتج واحد بعدة أصناف (Variants).
   * يتخطى أي صف SKU مكرر موجود أصلاً بقاعدة البيانات، ويجمع كل الأخطاء بدل التوقف عند أول خطأ.
   */
  async importFromExcel(buffer: Buffer, userId: string, storeId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      return { imported: 0, skipped: 0, errors: ['الملف فارغ أو غير صالح'] };
    }

    const headerRow = sheet.getRow(1).values as unknown[];
    const headerMap = new Map<string, number>();
    headerRow.forEach((h, idx) => {
      if (typeof h === 'string') headerMap.set(h.trim(), idx);
    });

   const missingHeaders = ['name', 'category', 'sku', 'costPrice', 'sellingPrice'].filter(
      (h) => !headerMap.has(h),
    );
    if (missingHeaders.length) {
      return { imported: 0, skipped: 0, errors: [`أعمدة ناقصة بالملف: ${missingHeaders.join(', ')}`] };
    }

    const cell = (row: ExcelJS.Row, key: string) => {
      const idx = headerMap.get(key);
      return idx ? row.getCell(idx).value : undefined;
    };

    const existingSkus = new Set((await this.prisma.variant.findMany({ where: { storeId }, select: { sku: true } })).map((v) => v.sku));
    const productCache = new Map<string, string>(); // "name|category" -> productId

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      if (row.cellCount === 0) continue;

      const name = String(cell(row, 'name') ?? '').trim();
      const category = String(cell(row, 'category') ?? '').trim();
      const sku = String(cell(row, 'sku') ?? '').trim();
     const costPrice = Number(cell(row, 'costPrice'));
     const sellingPrice = Number(cell(row, 'sellingPrice'));

     if (!name || !category || !sku || isNaN(costPrice) || isNaN(sellingPrice)) {
       errors.push(`صف ${rowNumber}: بيانات ناقصة أو غير صحيحة - تم تخطيه`);
       continue;
     }

     if (existingSkus.has(sku)) {
       skipped++;
       continue;
     }

     const productKey = `${name}|${category}`;
     let productId = productCache.get(productKey);

     if (!productId) {
       const existingProduct = await this.prisma.product.findFirst({ where: { name, category, storeId } });
       if (existingProduct) {
         productId = existingProduct.id;
       } else {
         const created = await this.prisma.product.create({ data: { name, category, storeId } });
         productId = created.id;
       }
       productCache.set(productKey, productId);
     }

     const size = String(cell(row, 'size') ?? '').trim() || undefined;
     const color = String(cell(row, 'color') ?? '').trim() || undefined;
      const wholesalePrice = Number(cell(row, 'wholesalePrice'));
      const vipPrice = Number(cell(row, 'vipPrice'));
      const stockQuantity = Number(cell(row, 'stockQuantity'));
      const minStockLevel = Number(cell(row, 'minStockLevel'));
      const barcodeRaw = cell(row, 'barcode');
      const expiryRaw = cell(row, 'expiryDate');
      const expiryDate = parseOptionalDate(expiryRaw);
      if (expiryRaw && !expiryDate) {
        errors.push(`صف ${rowNumber}: تاريخ انتهاء غير صالح - تم تخطيه`);
        continue;
      }

      try {
        await this.prisma.variant.create({
          data: {
            storeId,
            productId,
            sku,
            barcode: barcodeRaw ? String(barcodeRaw).trim() : undefined,
            size,
            color,
            costPrice,
            sellingPrice,
            wholesalePrice: !isNaN(wholesalePrice) && wholesalePrice > 0 ? wholesalePrice : undefined,
            vipPrice: !isNaN(vipPrice) && vipPrice > 0 ? vipPrice : undefined,
            stockQuantity: !isNaN(stockQuantity) ? stockQuantity : 0,
            minStockLevel: !isNaN(minStockLevel) ? minStockLevel : 5,
            expiryDate,
          },
        });
        existingSkus.add(sku);
        imported++;
      } catch (err: any) {
        errors.push(`صف ${rowNumber} (${sku}): تعذّر الحفظ - ${err.message}`);
      }
    }

    await this.audit.log(userId, 'PRODUCTS_IMPORTED', 'Product', undefined, { imported, skipped, errorsCount: errors.length });

    return { imported, skipped, errors };
  }
}
