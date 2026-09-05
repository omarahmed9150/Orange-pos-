import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { LicenseService } from './license.service';
import { ActivateLicenseDto } from './dto/activate-license.dto';

@ApiTags('License')
@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'حالة تفعيل الترخيص (طبقة تحقق مرتبطة بقاعدة البيانات)' })
  getStatus() {
    return this.licenseService.getStatus();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('activate')
  @ApiOperation({ summary: 'تفعيل الترخيص برمز صالح' })
  activate(@Body() dto: ActivateLicenseDto) {
    return this.licenseService.activate(dto.licenseKey);
  }
}
