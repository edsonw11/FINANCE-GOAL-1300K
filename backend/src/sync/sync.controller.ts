import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { type AuthenticatedSession } from '../auth/session.service';
import { parseInput } from '../http/parse-input';
import { changesQuerySchema, pushBodySchema } from './sync.schemas';
import { type ChangesPage, type PushResult, SyncService } from './sync.service';

/** Not @Public(): the login guard and the CSRF guard cover these routes like every other. */
@Controller('api/v1/sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('push')
  @HttpCode(200)
  async push(@CurrentUser() auth: AuthenticatedSession, @Body() body: unknown): Promise<{ results: PushResult[] }> {
    const { mutations } = parseInput(pushBodySchema, body);
    return { results: await this.sync.push(auth.userId, mutations) };
  }

  @Get('changes')
  changes(@CurrentUser() auth: AuthenticatedSession, @Query() query: unknown): Promise<ChangesPage> {
    const { cursor, limit } = parseInput(changesQuerySchema, query);
    return this.sync.changes(auth.userId, Number(cursor), limit);
  }
}
