import { Injectable } from '@nestjs/common';
import { type OidcIdentity } from '../auth/oidc-provider';
import { PrismaService } from '../database/prisma.service';
import { type UserRecord, type UserRepository } from './user.repository';

const select = { id: true, email: true, displayName: true } as const;

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertFromIdentity(identity: OidcIdentity, now: Date): Promise<UserRecord> {
    return this.prisma.appUser.upsert({
      // the identity is the pair (issuer, subject): the same e-mail at another issuer, or with another subject, is another person
      where: { oidcIssuer_oidcSubject: { oidcIssuer: identity.issuer, oidcSubject: identity.subject } },
      create: {
        oidcIssuer: identity.issuer,
        oidcSubject: identity.subject,
        email: identity.email,
        displayName: identity.displayName,
        lastLoginAt: now,
      },
      update: { email: identity.email, displayName: identity.displayName, lastLoginAt: now },
      select,
    });
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.appUser.findUnique({ where: { id }, select });
  }
}
