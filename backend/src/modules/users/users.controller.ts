import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users - لوحة Super Admin')
@ApiBearerAuth()
@Controller('users')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'إنشاء مستخدم جديد (حصرياً من الإدارة)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.create(dto, actor.userId);
  }

  @Get()
  @ApiOperation({ summary: 'عرض كل المستخدمين' })
  findAll(@CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.findAll(actor.storeId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تعديل بيانات/دور/كلمة سر مستخدم' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.update(id, dto, actor.userId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'حظر مستخدم (لا يحذف سجلاته المالية)' })
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.remove(id, actor.userId);
  }
}
