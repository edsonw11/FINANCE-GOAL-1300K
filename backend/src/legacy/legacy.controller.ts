import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { type AuthenticatedSession } from '../auth/session.service';
import { type LegacyState } from '../domain/domain-runtime';
import { parseInput } from '../http/parse-input';
import { type ImportSummary, LegacyStateService } from './legacy-state.service';

/** The import is the one place a body may be large (a whole history): see IMPORT_BODY_LIMIT_BYTES in create-app. */
export const IMPORT_PATH = '/api/v1/import/legacy-state';

const importQuery = z.strictObject({ replace: z.enum(['true', 'false']).default('false') });

@Controller('api/v1')
export class LegacyController {
  constructor(private readonly state: LegacyStateService) {}

  @Post('import/legacy-state')
  @HttpCode(200)
  importState(@CurrentUser() auth: AuthenticatedSession, @Body() body: unknown, @Query() query: unknown): Promise<ImportSummary> {
    const { replace } = parseInput(importQuery, query);
    return this.state.importState(auth.userId, body, replace === 'true');
  }

  @Get('export/legacy-state')
  exportState(@CurrentUser() auth: AuthenticatedSession): Promise<LegacyState> {
    return this.state.exportState(auth.userId);
  }
}
