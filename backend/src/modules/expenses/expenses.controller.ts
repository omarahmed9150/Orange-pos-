import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'تسجيل مصروف تشغيلي/يومي' })
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.create(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'عرض المصاريف (معزولة حسب المستخدم للكاشير)' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.findAll({ userId: user.userId, role: user.role as UserRole });
  }
}
