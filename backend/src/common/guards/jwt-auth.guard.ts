import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * حارس عام: كل Endpoint محمي بتوكن JWT افتراضياً،
 * إلا الـ Endpoints المعلّمة بـ @Public() مثل تسجيل الدخول.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser extends { accessToken?: string }>(
    err: unknown,
    user: TUser | undefined,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      return super.handleRequest(err, user, info, context);
    }

    const accessToken = user.accessToken;
    if (accessToken) {
      context.switchToHttp().getResponse().setHeader('x-renewed-token', accessToken);
    }
    return user;
  }
}
