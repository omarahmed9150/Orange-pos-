import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';

@ApiTags('Customers & Debt')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'إضافة عميل جديد' })
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.create(dto, user.storeId);
  }

  @Get()
  @ApiOperation({ summary: 'عرض كل العملاء' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.findAll(user.storeId);
  }

  @Get('search')
  @ApiOperation({ summary: 'بحث بالاسم مع تنبيه فوري إن كان للعميل دين متأخر 30 يوماً' })
  @ApiQuery({ name: 'q', required: true })
  search(@Query('q') q: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.search(q || '', user.storeId);
  }

  @Get('alerts/overdue-debt')
  @ApiOperation({ summary: 'كل العملاء الذين لديهم دين متأخر 30 يوماً فأكثر' })
  getOverdueDebtAlerts(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.getOverdueDebtAlerts(user.storeId);
  }

  @Get(':id/statement')
  @ApiOperation({ summary: 'كشف حساب العميل (فواتير الدين، الدفعات، المتبقي)' })
  getStatement(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.getStatement(id, user.storeId);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'تسجيل دفعة تسديد من العميل' })
  addPayment(@Param('id') id: string, @Body() dto: CreateCustomerPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.addPayment(id, dto, user.userId, user.storeId);
  }
}
