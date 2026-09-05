import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';

const MAX_BACKUPS_TO_KEEP = 14;

@Injectable()
export class DatabaseBackupService {
  private readonly logger = new Logger(DatabaseBackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storeSettings: StoreSettingsService,
  ) {}

  /** المسار الفعلي لملف قاعدة البيانات (SQLite) الحالي على القرص */
  private getDbFilePath(): string {
    const url = process.env.DATABASE_URL || 'file:./orange.db';
    const relativePath = url.replace(/^file:/, '');
    return path.resolve(process.cwd(), relativePath);
  }

  /** نسخة احتياطية كاملة لملف قاعدة البيانات كل 6 ساعات، تُحفظ بمجلد خارجي (قرص/مزامنة) يحدده صاحب المحل */
  @Cron(CronExpression.EVERY_6_HOURS)
  async runScheduledBackup() {
    const settings = await this.storeSettings.get();
    if (!settings.dbBackupDir) {
      this.logger.warn('لم يُضبط مجلد النسخ الاحتياطي المحلي بعد - تخطي.');
      return;
    }
    await this.runBackupNow(settings.dbBackupDir);
  }

  /** ينفّذ نسخة احتياطية فورية إلى المجلد المحدد، ويحذف النسخ الأقدم من الحد الأقصى */
  async runBackupNow(targetDir?: string) {
    const settings = await this.storeSettings.get();
    const dir = targetDir || settings.dbBackupDir;

    if (!dir) {
      return { success: false, message: 'لم يتم ضبط مجلد النسخ الاحتياطي بعد من الإعدادات.' };
    }

    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const dbPath = this.getDbFilePath();
      if (!fs.existsSync(dbPath)) {
        return { success: false, message: 'تعذر إيجاد ملف قاعدة البيانات الحالي.' };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const destPath = path.join(dir, `orange_db_backup_${timestamp}.sqlite`);
      const escapedDestPath = destPath.replace(/'/g, "''");
      await this.prisma.$executeRawUnsafe(`VACUUM INTO '${escapedDestPath}'`);

      this.rotateOldBackups(dir);

      this.logger.log(`تم إنشاء نسخة احتياطية: ${destPath}`);
      return { success: true, message: 'تم إنشاء النسخة الاحتياطية بنجاح', path: destPath };
    } catch (err: any) {
      this.logger.error(`فشل النسخ الاحتياطي المحلي: ${err.message}`);
      return { success: false, message: `فشل النسخ الاحتياطي: ${err.message}` };
    }
  }

  private rotateOldBackups(dir: string) {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('orange_db_backup_'))
      .map((f) => ({ name: f, time: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    for (const old of files.slice(MAX_BACKUPS_TO_KEEP)) {
      fs.unlinkSync(path.join(dir, old.name));
    }
  }

  /** حالة آخر نسخة احتياطية (للعرض بواجهة الإعدادات) */
  async getStatus() {
    const settings = await this.storeSettings.get();
    if (!settings.dbBackupDir || !fs.existsSync(settings.dbBackupDir)) {
      return { configured: !!settings.dbBackupDir, lastBackupAt: null, backupsCount: 0 };
    }

    const files = fs
      .readdirSync(settings.dbBackupDir)
      .filter((f) => f.startsWith('orange_db_backup_'))
      .map((f) => fs.statSync(path.join(settings.dbBackupDir!, f)).mtimeMs)
      .sort((a, b) => b - a);

    return {
      configured: true,
      lastBackupAt: files[0] ? new Date(files[0]).toISOString() : null,
      backupsCount: files.length,
    };
  }
}
