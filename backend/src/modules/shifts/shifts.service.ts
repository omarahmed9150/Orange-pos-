import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, ShiftStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';

export interface ShiftSummary {
  shiftId: string;
  cashierId: string;
  startTime: Date;
  initialCash: number;
  cashSalesTotal: number;
  cardSalesTotal: number;
  totalSales: number;
  saleCount: number;
  expectedCash: number;
}

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async open(cashierId: string, dto: OpenShiftDto, storeId: string) {
    const existingOpen = await this.prisma.shift.findFirst({
      where: { cashierId, storeId, status: ShiftStatus.OPEN },
    });

    if (existingOpen) {
      throw new BadRequestException('Cashier already has an open shift');
    }

    return this.prisma.shift.create({
      data: {
        cashierId,
        storeId,
        initialCash: dto.initialCash,
        notes: dto.notes,
        status: ShiftStatus.OPEN,
      },
    });
  }

  async getSummary(shiftId: string, requester?: { userId: string; role: UserRole; storeId?: string }): Promise<ShiftSummary> {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId, ...(requester?.storeId ? { storeId: requester.storeId } : {}) },
      include: { sales: true, expenses: true },
    });

    if (!shift) {
      throw new NotFoundException(`Shift ${shiftId} not found`);
    }
    if (requester && requester.role === UserRole.CASHIER && shift.cashierId !== requester.userId) {
      throw new NotFoundException(`Shift ${shiftId} not found`);
    }

    const cashSalesTotal = shift.sales
      .reduce((sum, sale) => sum + (sale.paymentMethod === PaymentMethod.MIXED
        ? Number(sale.cashAmount ?? 0)
        : sale.paymentMethod === PaymentMethod.CASH ? Number(sale.totalAmount) : 0), 0);

    const cardSalesTotal = shift.sales
      .reduce((sum, sale) => sum + (sale.paymentMethod === PaymentMethod.MIXED
        ? Number(sale.cardAmount ?? 0) + Number(sale.mobileAmount ?? 0)
        : (sale.paymentMethod === PaymentMethod.CARD || sale.paymentMethod === PaymentMethod.MOBILE)
          ? Number(sale.totalAmount) : 0), 0);

    const totalSales = shift.sales.reduce(
      (sum, sale) => sum + Number(sale.totalAmount),
      0,
    );

    const cashExpenses = (shift.expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0);
    const expectedCash = Number(shift.initialCash) + cashSalesTotal - Number(cashExpenses);

    return {
      shiftId: shift.id,
      cashierId: shift.cashierId,
      startTime: shift.startTime,
      initialCash: Number(shift.initialCash),
      cashSalesTotal,
      cardSalesTotal,
      totalSales,
      saleCount: shift.sales.length,
      expectedCash,
    };
  }

  async close(shiftId: string, dto: CloseShiftDto, requester?: { userId: string; role: UserRole; storeId?: string }) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId, ...(requester?.storeId ? { storeId: requester.storeId } : {}) },
      include: { sales: true },
    });

    if (!shift) {
      throw new NotFoundException(`Shift ${shiftId} not found`);
    }
    if (requester && requester.role === UserRole.CASHIER && shift.cashierId !== requester.userId) {
      throw new NotFoundException(`Shift ${shiftId} not found`);
    }

    if (shift.status === ShiftStatus.CLOSED) {
      throw new BadRequestException('Shift is already closed');
    }

    const summary = await this.getSummary(shiftId, requester);

    return this.prisma.shift.update({
      where: { id: shiftId },
      data: {
        endTime: new Date(),
        actualCash: dto.actualCash,
        expectedCash: summary.expectedCash,
        notes: dto.notes ?? shift.notes,
        status: ShiftStatus.CLOSED,
      },
    });
  }

  findOpenByCashier(cashierId: string, storeId: string) {
    return this.prisma.shift.findFirst({
      where: { cashierId, storeId, status: ShiftStatus.OPEN },
      include: { sales: true },
    });
  }
}
