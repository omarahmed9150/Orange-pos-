import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReceiptType, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReceiptTemplatesService } from './receipt-templates.service';
import { SaveTemplateDto } from './dto/save-template.dto';

@ApiTags('Receipt Designer')
@ApiBearerAuth()
@Controller('receipt-templates')
export class ReceiptTemplatesController {
  constructor(private readonly service: ReceiptTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'عرض كل قوالب الأوصلة المحفوظة' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.storeId);
  }

  @Get('active')
  @ApiOperation({ summary: 'القالب النشط لنوع عملية معيّن (يُستخدم عند الطباعة الفعلية)' })
  @ApiQuery({ name: 'type', enum: ReceiptType, required: false })
  getActive(@Query('type') type: ReceiptType | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getActive(type ?? ReceiptType.CASH, user.storeId);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'حفظ قالب وصل جديد (يتطلب صلاحية إدارية)' })
  save(@Body() dto: SaveTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.save(dto, user.userId, user.storeId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'حذف قالب' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.userId, user.storeId);
  }
}
