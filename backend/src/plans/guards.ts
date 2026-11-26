import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type FastifyRequest } from 'fastify';
import '../auth/request-auth';
import { EntitlementsService } from './entitlements.service';
import { type FeatureKey } from './features';

const FEATURE_KEY = 'requires-feature';
const ADMIN_KEY = 'requires-admin';

/** The route works only on a plan that has this feature. The answer is 403 with a code the app turns into the PRO screen. */
export const RequiresFeature = (feature: FeatureKey) => SetMetadata(FEATURE_KEY, feature);
/** The route is for the people who run the product (is_admin in the database). */
export const AdminOnly = () => SetMetadata(ADMIN_KEY, true);

/** Both guards are global. A route with neither mark passes untouched; a marked route without a login is 401 whatever the guard order. */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<FeatureKey | undefined>(FEATURE_KEY, [context.getHandler(), context.getClass()]);
    if (!feature) return true;
    const auth = context.switchToHttp().getRequest<FastifyRequest>().auth;
    if (!auth) throw new UnauthorizedException();
    if (await this.entitlements.has(auth.userId, feature)) return true;
    throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'feature_locked', feature });
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.reflector.getAllAndOverride<boolean | undefined>(ADMIN_KEY, [context.getHandler(), context.getClass()])) return true;
    const auth = context.switchToHttp().getRequest<FastifyRequest>().auth;
    if (!auth) throw new UnauthorizedException();
    // read again every time: taking the flag away stops the access at once
    if ((await this.entitlements.forUser(auth.userId))?.isAdmin) return true;
    throw new ForbiddenException();
  }
}
