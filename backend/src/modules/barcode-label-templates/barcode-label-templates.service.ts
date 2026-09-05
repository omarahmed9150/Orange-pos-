import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SaveBarcodeLabelTemplateDto } from './dto/save-template.dto';

@Injectable()
export class BarcodeLabelTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(storeId = 'default-store') {
    const rows = await this.prisma.barcodeLabelTemplate.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({ ...row, config: JSON.parse(row.config) }));
  }

  async getActive(storeId = 'default-store') {
    const row = await this.prisma.barcodeLabelTemplate.findFirst({
      where: { isDefault: true, storeId },
      orderBy: { updatedAt: 'desc' },
    });
    return row ? { ...row, config: JSON.parse(row.config) } : null;
  }

  async save(dto: SaveBarcodeLabelTemplateDto, userId: string, storeId = 'default-store') {
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.barcodeLabelTemplate.create({
        data: {
          name: dto.name,
          storeId,
          isDefault: dto.isDefault ?? false,
          config: JSON.stringify(dto.config),
        },
      });
      if (created.isDefault) {
        await tx.barcodeLabelTemplate.updateMany({
          where: { id: { not: created.id }, storeId },
          data: { isDefault: false },
        });
      }
      return created;
    });
    await this.audit.log(userId, 'BARCODE_LABEL_TEMPLATE_SAVED', 'BarcodeLabelTemplate', row.id, { name: row.name });
    return { ...row, config: JSON.parse(row.config) };
  }

  async remove(id: string, userId: string, storeId = 'default-store') {
    const row = await this.prisma.barcodeLabelTemplate.findFirst({ where: { id, storeId } });
    if (!row) throw new NotFoundException('قالب الملصق غير موجود');
    await this.prisma.barcodeLabelTemplate.delete({ where: { id } });
    await this.audit.log(userId, 'BARCODE_LABEL_TEMPLATE_DELETED', 'BarcodeLabelTemplate', id, { name: row.name });
    return { message: 'تم حذف قالب الملصق' };
  }
}
