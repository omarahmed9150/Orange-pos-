import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RefundSaleDto } from './dto/refund-sale.dto';
import { ExchangeSaleDto } from './dto/exchange-sale.dto';

@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a sale transaction' })
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.create(dto, user.userId, user.storeId);
  }

  @Get('shift/:shiftId')
  @ApiOperation({ summary: 'List sales for a shift (معزولة حسب المستخدم للكاشير)' })
  findByShift(@Param('shiftId') shiftId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.findByShift(shiftId, { userId: user.userId, role: user.role as UserRole });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.findOne(id, { userId: user.userId, role: user.role as UserRole });
  }

  @Post(':id/refund')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: '🔄 استرجاع فاتورة (كامل أو جزئي)' })
  refund(@Param('id') id: string, @Body() dto: RefundSaleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.refund(id, dto, { userId: user.userId, username: user.username });
  }

  @Post(':id/exchange')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: '↔️ استبدال منتج بآخر مع حساب فرق السعر تلقائياً' })
  exchange(@Param('id') id: string, @Body() dto: ExchangeSaleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.exchange(id, dto, { userId: user.userId, username: user.username });
  }
}
