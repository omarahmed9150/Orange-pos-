import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { LicenseService } from './license.service';
import { ActivateLicenseDto } from './dto/activate-license.dto';

@ApiTags('License')
@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('status')
  @ApiOperation({ summary: 'حالة تفعيل الترخيص (طبقة تحقق مرتبطة بقاعدة البيانات)' })
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.licenseService.getStatus(user.storeId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('activate')
  @ApiOperation({ summary: 'تفعيل الترخيص برمز صالح' })
  activate(@Body() dto: ActivateLicenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.licenseService.activate(user.storeId, dto.licenseKey);
  }
}
