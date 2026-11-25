import { Inject, Injectable } from '@nestjs/common';
import { type AppConfig } from '../config/app-config';
import { APP_CONFIG } from '../config/app-config';
import { CLOCK, type Clock } from '../clock';
import { hashToken, looksLikeToken, newOpaqueToken } from './opaque-token';
import { SESSION_REPOSITORY, type SessionRepository } from './session.repository';

/** "Last seen" is written at most this often, so reading the session does not become a write on every request. */
export const TOUCH_INTERVAL_MS = 60_000;

export interface AuthenticatedSession {
  readonly userId: string;
  readonly sessionId: string;
}

/** Creates, checks and ends logins. Knows nothing about HTTP or about the identity provider. */
@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly repository: SessionRepository,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'session'>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** A new login. Always a new random value, never one chosen by the caller (no session fixation). */
  async create(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const now = this.clock.now();
    const token = newOpaqueToken();
    const expiresAt = new Date(now.getTime() + this.config.session.ttlMs);
    await this.repository.insert({ idHash: hashToken(token), userId, createdAt: now, lastSeenAt: now, expiresAt });
    return { token, expiresAt };
  }

  /** Who is logged in with this cookie value, or null (unknown, malformed, expired, idle for too long). */
  async authenticate(token: unknown): Promise<AuthenticatedSession | null> {
    if (!looksLikeToken(token)) return null;
    const idHash = hashToken(token);
    const session = await this.repository.find(idHash);
    if (!session) return null;
    const now = this.clock.now();
    const idle = now.getTime() - session.lastSeenAt.getTime() >= this.config.session.idleMs;
    if (session.expiresAt.getTime() <= now.getTime() || idle) {
      await this.repository.delete(idHash);
      return null;
    }
    if (now.getTime() - session.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) await this.repository.touch(idHash, now);
    return { userId: session.userId, sessionId: idHash };
  }

  /** Ends this login. Unknown or malformed values are ignored: logging out twice is fine. */
  async revoke(token: unknown): Promise<void> {
    if (!looksLikeToken(token)) return;
    await this.repository.delete(hashToken(token));
  }

  /** Ends every login of a person (all devices). */
  revokeAllFor(userId: string): Promise<number> {
    return this.repository.deleteAllForUser(userId);
  }

  /** Housekeeping: removes sessions past their absolute expiry. */
  purgeExpired(): Promise<number> {
    return this.repository.deleteExpired(this.clock.now());
  }
}
