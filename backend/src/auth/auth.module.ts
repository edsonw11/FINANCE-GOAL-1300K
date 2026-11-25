import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { PlansModule } from '../plans/plans.module';
import { PrismaUserRepository } from '../users/prisma-user.repository';
import { USER_REPOSITORY } from '../users/user.repository';
import { AUTH_FLOW_REPOSITORY } from './auth-flow.repository';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { CsrfGuard } from './csrf.guard';
import { LoginService } from './login.service';
import { MeController } from './me.controller';
import { OIDC_PROVIDER } from './oidc-provider';
import { OpenIdClientProvider } from './openid-client.provider';
import { PrismaAuthFlowRepository } from './prisma-auth-flow.repository';
import { PrismaSessionRepository } from './prisma-session.repository';
import { SESSION_REPOSITORY } from './session.repository';
import { SessionService } from './session.service';

@Module({
  imports: [DatabaseModule, PlansModule],
  controllers: [AuthController, MeController],
  providers: [
    SessionService,
    LoginService,
    { provide: OIDC_PROVIDER, useClass: OpenIdClientProvider },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: AUTH_FLOW_REPOSITORY, useClass: PrismaAuthFlowRepository },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    // global guards run in this order: the cheap origin check first, then the login check. Every route is covered.
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
