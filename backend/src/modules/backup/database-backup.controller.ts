import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { DatabaseBackupService } from './database-backup.service';

@ApiTags('Local Database Backup')
@ApiBearerAuth()
@Controller('backup/database')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class DatabaseBackupController {
  constructor(private readonly service: DatabaseBackupService) {}

  @Get('status')
  @ApiOperation({ summary: 'حالة آخر نسخة احتياطية محلية لقاعدة البيانات' })
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getStatus(user.storeId);
  }

  @Post('run-now')
  @ApiOperation({ summary: 'تنفيذ نسخة احتياطية فورية لقاعدة البيانات الآن' })
  runNow(@CurrentUser() user: AuthenticatedUser) {
    return this.service.runBackupNow(undefined, user.storeId);
  }
}
