import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierPaymentDto } from './dto/create-payment.dto';

@ApiTags('Suppliers')
@ApiBearerAuth()
@Controller('suppliers')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'إضافة مورد جديد' })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.create(dto, user.storeId);
  }

  @Get()
  @ApiOperation({ summary: 'عرض كل الموردين' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.findAll(user.storeId);
  }

  @Get('alerts/overdue-debt')
  @ApiOperation({ summary: 'كل الموردين الذين لهم دين مستحق علينا 30 يوماً فأكثر' })
  getOverdueDebtAlerts(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.getOverdueDebtAlerts(user.storeId);
  }

  @Get(':id/statement')
  @ApiOperation({ summary: 'كشف حساب المورد (مشتريات، مدفوعات، الدين المتبقي)' })
  getStatement(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.getStatement(id, user.storeId);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'تسجيل دفعة تسديد لدين المورد' })
  addPayment(@Param('id') id: string, @Body() dto: CreateSupplierPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.addPayment(id, dto, user.userId, user.storeId);
  }
}
