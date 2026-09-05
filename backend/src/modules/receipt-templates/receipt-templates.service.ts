import { Injectable, NotFoundException } from '@nestjs/common';
import { ReceiptType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SaveTemplateDto } from './dto/save-template.dto';

@Injectable()
export class ReceiptTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(storeId = 'default-store') {
    return this.prisma.receiptTemplate.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } }).then((rows) =>
      rows.map((r) => ({ ...r, config: JSON.parse(r.config) })),
    );
  }

  /** يرجّع القالب النشط لنوع عملية معيّن، مع رجوع تلقائي للقالب العام إذا لم يوجد قالب خاص */
  async getActive(appliesTo: ReceiptType, storeId = 'default-store') {
    const specific = await this.prisma.receiptTemplate.findFirst({
      where: { appliesTo, isDefault: true, storeId },
    });
    const template =
      specific ?? (await this.prisma.receiptTemplate.findFirst({       where: { appliesTo: ReceiptType.ALL, isDefault: true, storeId } }));

    if (!template) return null;
    return { ...template, config: JSON.parse(template.config) };
  }

  async save(dto: SaveTemplateDto, actingUserId: string, storeId = 'default-store') {
    const created = await this.prisma.$transaction(async (tx) => {
      const template = await tx.receiptTemplate.create({
        data: {
          name: dto.name,
          storeId,
          appliesTo: dto.appliesTo ?? ReceiptType.ALL,
          isDefault: dto.isDefault ?? false,
          config: JSON.stringify(dto.config),
        },
      });

      // نضمن وجود قالب افتراضي واحد فقط لكل نوع عملية
      if (template.isDefault) {
        await tx.receiptTemplate.updateMany({
          where: { appliesTo: template.appliesTo, storeId, id: { not: template.id } },
          data: { isDefault: false },
        });
      }

      return template;
    });

    await this.audit.log(actingUserId, 'RECEIPT_TEMPLATE_SAVED', 'ReceiptTemplate', created.id, {
      name: created.name,
      appliesTo: created.appliesTo,
    });

    return { ...created, config: JSON.parse(created.config) };
  }

  async remove(id: string, actingUserId: string, storeId = 'default-store') {
    const template = await this.prisma.receiptTemplate.findFirst({ where: { id, storeId } });
    if (!template) throw new NotFoundException('القالب غير موجود');

    await this.prisma.receiptTemplate.delete({ where: { id } });
    await this.audit.log(actingUserId, 'RECEIPT_TEMPLATE_DELETED', 'ReceiptTemplate', id, { name: template.name });

    return { message: 'تم حذف القالب' };
  }
}
