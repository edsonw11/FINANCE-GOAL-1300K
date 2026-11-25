import { Controller, Get, Inject, UnauthorizedException } from '@nestjs/common';
import { USER_REPOSITORY, type UserRepository } from '../users/user.repository';
import { CurrentUser } from './current-user.decorator';
import { type AuthenticatedSession } from './session.service';

@Controller('api/v1/me')
export class MeController {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  @Get()
  async me(@CurrentUser() auth: AuthenticatedSession): Promise<{ id: string; email: string | null; displayName: string | null }> {
    const user = await this.users.findById(auth.userId);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email, displayName: user.displayName };
  }
}
