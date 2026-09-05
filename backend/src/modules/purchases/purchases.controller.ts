import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@ApiTags('Purchases')
@ApiBearerAuth()
@Controller('purchases')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @ApiOperation({ summary: 'تسجيل فاتورة شراء (تزيد المخزون تلقائياً)' })
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.purchasesService.create(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'عرض كل فواتير الشراء' })
  findAll() {
    return this.purchasesService.findAll();
  }
}
