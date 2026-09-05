import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { DatabaseBackupService } from './database-backup.service';

@ApiTags('Local Database Backup')
@ApiBearerAuth()
@Controller('backup/database')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class DatabaseBackupController {
  constructor(private readonly service: DatabaseBackupService) {}

  @Get('status')
  @ApiOperation({ summary: 'حالة آخر نسخة احتياطية محلية لقاعدة البيانات' })
  getStatus() {
    return this.service.getStatus();
  }

  @Post('run-now')
  @ApiOperation({ summary: 'تنفيذ نسخة احتياطية فورية لقاعدة البيانات الآن' })
  runNow() {
    return this.service.runBackupNow();
  }
}
