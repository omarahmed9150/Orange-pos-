import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { BarcodeLabelTemplatesService } from './barcode-label-templates.service';
import { SaveBarcodeLabelTemplateDto } from './dto/save-template.dto';

@ApiTags('Barcode Label Designer')
@ApiBearerAuth()
@Controller('barcode-label-templates')
export class BarcodeLabelTemplatesController {
  constructor(private readonly service: BarcodeLabelTemplatesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.storeId);
  }

  @Get('active')
  getActive(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getActive(user.storeId);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'حفظ قالب ملصق باركود' })
  save(@Body() dto: SaveBarcodeLabelTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.save(dto, user.userId, user.storeId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.userId, user.storeId);
  }
}
