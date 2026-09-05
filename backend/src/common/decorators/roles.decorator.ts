import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
/** يحدد الأدوار المسموح لها بالوصول لهذا الـ Endpoint */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
