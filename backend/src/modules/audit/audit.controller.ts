import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('Audit Log')
@ApiBearerAuth()
@Controller('audit-log')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'عرض سجل التدقيق لكل العمليات الحساسة (لا يمكن حذفه من أي واجهة)' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'userId', required: false })
  findAll(@Query('entityType') entityType?: string, @Query('userId') userId?: string) {
    return this.auditService.findAll({ entityType, userId });
  }
}
