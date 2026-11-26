import { Controller, Get, Inject, UnauthorizedException } from '@nestjs/common';
import { EntitlementsService } from '../plans/entitlements.service';
import { USER_REPOSITORY, type UserRepository } from '../users/user.repository';
import { CurrentUser } from './current-user.decorator';
import { type AuthenticatedSession } from './session.service';

@Controller('api/v1/me')
export class MeController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get()
  async me(@CurrentUser() auth: AuthenticatedSession) {
    const user = await this.users.findById(auth.userId);
    if (!user) throw new UnauthorizedException();
    const entitlements = await this.entitlements.forUser(auth.userId);
    if (!entitlements) throw new UnauthorizedException();
    // what the app needs to show the PRO badges; the server checks again on every protected route
    return { id: user.id, email: user.email, displayName: user.displayName, plan: entitlements.plan, features: entitlements.features };
  }
}
