import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: string;
  storeId: string;
}

/** يستخرج المستخدم الحالي من التوكن (لتطبيق عزل البيانات في كل Service) */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user?.storeId || user.storeId === 'null' || user.storeId === 'undefined') {
      throw new UnauthorizedException('معرف المتجر غير صالح');
    }
    return user;
  },
);
