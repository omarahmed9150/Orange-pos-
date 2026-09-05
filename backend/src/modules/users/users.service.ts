import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateUserDto, actingUserId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: actingUserId } });
    if (!actor || actor.role !== 'SUPER_ADMIN') {
      throw new ConflictException('إنشاء المستخدمين متاح للمدير الأعلى فقط');
    }
    const exists = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (exists) throw new ConflictException('اسم المستخدم مستخدم بالفعل');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        fullName: dto.fullName,
        role: dto.role,
        passwordHash,
        storeId: actor.storeId,
      },
    });

    await this.audit.log(actingUserId, 'USER_CREATED', 'User', user.id, { username: user.username, role: user.role });
    return this.sanitize(user);
  }

  async findAll(storeId = 'default-store') {
    const users = await this.prisma.user.findMany({ where: { storeId }, orderBy: { createdAt: 'asc' } });
    return users.map(this.sanitize);
  }

  async update(id: string, dto: UpdateUserDto, actingUserId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: actingUserId } });
    if (!actor || actor.role !== 'SUPER_ADMIN') {
      throw new ConflictException('تعديل المستخدمين متاح للمدير الأعلى فقط');
    }
    const user = await this.prisma.user.findFirst({ where: { id, storeId: actor.storeId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    const updated = await this.prisma.user.update({ where: { id }, data });

    await this.audit.log(actingUserId, 'USER_UPDATED', 'User', id, {
      changedFields: Object.keys(data).filter((k) => k !== 'passwordHash'),
      passwordChanged: !!dto.password,
    });

    return this.sanitize(updated);
  }

  /**
   * "حذف" مستخدم = حظر فوري (isActive=false) وليس حذف فعلي من قاعدة البيانات.
   * السبب: سجلاته (مبيعات/ورديات/مصاريف) مالية ويجب ألا تُفقد أو تُيتّم.
   */
  async remove(id: string, actingUserId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: actingUserId } });
    if (!actor || actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('حظر المستخدمين متاح للمدير الأعلى فقط');
    }
    const user = await this.prisma.user.findFirst({ where: { id, storeId: actor.storeId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    if (id === actingUserId) {
      throw new ConflictException('لا يمكن حظر المستخدم الحالي');
    }

    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    await this.audit.log(actingUserId, 'USER_BLOCKED', 'User', id, { username: user.username });

    return { message: 'تم حظر المستخدم بنجاح (تم الاحتفاظ بسجلاته المالية)' };
  }

  private sanitize(user: { passwordHash?: string; [key: string]: unknown }) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
