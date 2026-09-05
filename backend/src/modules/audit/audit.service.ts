import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** يسجل عملية حساسة مع من نفّذها ومتى (لا يمكن حذف هذه السجلات من أي واجهة) */
  async log(userId: string, action: string, entityType: string, entityId?: string, details?: unknown) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: details ? JSON.stringify(details) : undefined,
      },
    });
  }

  findAll(filters: { entityType?: string; userId?: string }) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType: filters.entityType,
        userId: filters.userId,
      },
      include: { user: { select: { username: true, fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }
}
