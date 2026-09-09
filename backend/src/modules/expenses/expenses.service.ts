import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateExpenseDto, userId: string, storeId: string) {
    if (dto.shiftId) {
      const shift = await this.prisma.shift.findFirst({ where: { id: dto.shiftId, storeId } });
      if (!shift) throw new NotFoundException('الوردية غير موجودة');
      if (shift.cashierId !== userId) throw new BadRequestException('لا يمكن إضافة مصروف لوردية مستخدم آخر');
      if (shift.status !== 'OPEN') throw new BadRequestException('لا يمكن إضافة مصروف لوردية مغلقة');
    }
    const expense = await this.prisma.expense.create({
      data: { ...dto, userId, storeId },
    });
    await this.audit.log(userId, 'EXPENSE_ADDED', 'Expense', expense.id, {
      title: expense.title,
      amount: expense.amount,
    });
    return expense;
  }

  /** عزل البيانات: الكاشير يرى مصاريفه فقط، الإدارة ترى الكل */
  findAll(requester: { userId: string; role: UserRole; storeId: string }) {
    const isPrivileged = requester.role !== UserRole.CASHIER;
    return this.prisma.expense.findMany({
      where: isPrivileged ? { storeId: requester.storeId } : { storeId: requester.storeId, userId: requester.userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
