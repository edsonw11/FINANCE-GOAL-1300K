import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { type AuthenticatedSession } from '../auth/session.service';
import { CLOCK, type Clock } from '../clock';
import { parseInput } from '../http/parse-input';
import { AUDIT_REPOSITORY, type AuditRepository } from './audit.repository';
import { isFeatureKey } from './features';
import { AdminOnly } from './guards';
import { type ChangeResult, PLAN_REPOSITORY, type PlanRepository, type PlanView } from './plan.repository';

const planIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,30}$/);
const userPlanSchema = z.strictObject({ planId: planIdSchema });

/** Turning features on and off per plan, and moving a person to a plan. Every real change is written to the audit log. */
@AdminOnly()
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get('plans')
  async list(): Promise<{ plans: PlanView[] }> {
    return { plans: await this.plans.listPlans() };
  }

  @Put('plans/:planId/features/:key')
  @HttpCode(200)
  async enable(@CurrentUser() auth: AuthenticatedSession, @Param('planId') planId: string, @Param('key') key: string) {
    const [id, feature] = this.checked(planId, key);
    const result = await this.plans.addFeature(id, feature);
    return this.finish(auth, result, 'plan.feature.enable', `plan:${id}`, { feature }, { planId: id, feature, enabled: true });
  }

  @Delete('plans/:planId/features/:key')
  @HttpCode(200)
  async disable(@CurrentUser() auth: AuthenticatedSession, @Param('planId') planId: string, @Param('key') key: string) {
    const [id, feature] = this.checked(planId, key);
    const result = await this.plans.removeFeature(id, feature);
    return this.finish(auth, result, 'plan.feature.disable', `plan:${id}`, { feature }, { planId: id, feature, enabled: false });
  }

  @Put('users/:userId/plan')
  @HttpCode(200)
  async setPlan(@CurrentUser() auth: AuthenticatedSession, @Param('userId') userId: string, @Body() body: unknown) {
    const target = parseInput(z.uuid(), userId);
    const { planId } = parseInput(userPlanSchema, body);
    const result = await this.plans.setUserPlan(target, planId);
    if (result === 'no_user') throw new NotFoundException();
    return this.finish(auth, result, 'user.plan.set', `user:${target}`, { planId }, { userId: target, planId });
  }

  private checked(planId: string, key: string): [string, string] {
    const id = parseInput(planIdSchema, planId);
    // only keys of the catalogue: a typo must not create a feature nothing checks
    if (!isFeatureKey(key)) throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: 'Invalid request', code: 'unknown_feature' });
    return [id, key];
  }

  private async finish<T>(auth: AuthenticatedSession, result: ChangeResult, action: string, target: string, details: Record<string, unknown>, answer: T): Promise<T & { changed: boolean }> {
    if (result === 'no_plan') throw new NotFoundException();
    if (result === 'changed') await this.audit.record({ actorUserId: auth.userId, action, target, details }, this.clock.now());
    return { ...answer, changed: result === 'changed' };
  }
}
