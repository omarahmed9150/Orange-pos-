import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';
import { StockCountDto } from './dto/stock-count.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('alerts')
  @ApiOperation({ summary: 'تنبيهات نفاد المخزون وقرب انتهاء الصلاحية' })
  getAlerts() {
    return this.inventoryService.getAlerts();
  }

  @Get('movements/:variantId')
  @ApiOperation({ summary: 'سجل حركة صنف معيّن' })
  movementHistory(@Param('variantId') variantId: string) {
    return this.inventoryService.movementHistory(variantId);
  }

  @Post('count')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'تطبيق جرد كامل أو جزئي (يعدّل الفروقات تلقائياً)' })
  applyStockCount(@Body() dto: StockCountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.applyStockCount(dto, user.userId);
  }
}
