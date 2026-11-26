import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { type AuthenticatedSession } from '../auth/session.service';
import { parseInput } from '../http/parse-input';
import { RequiresFeature } from '../plans/guards';
import { FinanceRulesService } from './finance-rules.service';

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const reportQuery = z.strictObject({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

type Rule<A extends unknown[], R> = (...args: A) => R;

/** What the person's month looks like, calculated by the shared rules from their stored data. */
@Controller('api/v1/months')
export class MonthsController {
  constructor(private readonly rules: FinanceRulesService) {}

  @Get(':month/summary')
  summary(@CurrentUser() auth: AuthenticatedSession, @Param('month') month: string): Promise<unknown> {
    const m = parseInput(monthSchema, month);
    return this.rules.compute(auth.userId, (api) => (api.monthSummary as Rule<[string], unknown>)(m));
  }

  @Get(':month/result')
  result(@CurrentUser() auth: AuthenticatedSession, @Param('month') month: string): Promise<unknown> {
    const m = parseInput(monthSchema, month);
    return this.rules.compute(auth.userId, (api) => (api.monthResult as Rule<[string], unknown>)(m));
  }

  /** The monthly report is a Pro feature (the first real use of a locked route). `today` is for a person whose day differs from the server's. */
  @Get(':month/report')
  @RequiresFeature('report.monthly')
  report(@CurrentUser() auth: AuthenticatedSession, @Param('month') month: string, @Query() query: unknown): Promise<unknown> {
    const m = parseInput(monthSchema, month);
    const { today } = parseInput(reportQuery, query);
    return this.rules.compute(auth.userId, (api) => (today ? (api.buildReport as Rule<[string, string], unknown>)(m, today) : (api.buildReport as Rule<[string], unknown>)(m)));
  }
}
