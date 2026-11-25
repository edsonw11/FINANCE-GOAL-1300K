import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { type ChangeResult, type PlanRepository, type PlanView, type UserPlan } from './plan.repository';

@Injectable()
export class PrismaPlanRepository implements PlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async planOf(userId: string): Promise<UserPlan | null> {
    const user = await this.prisma.appUser.findUnique({ where: { id: userId }, select: { isAdmin: true, plan: { select: { id: true, name: true } } } });
    return user ? { planId: user.plan.id, planName: user.plan.name, isAdmin: user.isAdmin } : null;
  }

  async featuresOf(planId: string): Promise<string[]> {
    const rows = await this.prisma.planFeature.findMany({ where: { planId }, orderBy: { featureKey: 'asc' } });
    return rows.map((r) => r.featureKey);
  }

  async listPlans(): Promise<PlanView[]> {
    const plans = await this.prisma.plan.findMany({ orderBy: { id: 'asc' }, include: { features: { orderBy: { featureKey: 'asc' } } } });
    return plans.map((p) => ({ id: p.id, name: p.name, features: p.features.map((f) => f.featureKey) }));
  }

  async addFeature(planId: string, featureKey: string): Promise<ChangeResult> {
    if (!(await this.prisma.plan.findUnique({ where: { id: planId }, select: { id: true } }))) return 'no_plan';
    const added = await this.prisma.$executeRaw`INSERT INTO plan_feature (plan_id, feature_key) VALUES (${planId}, ${featureKey}) ON CONFLICT DO NOTHING`;
    return added > 0 ? 'changed' : 'unchanged';
  }

  async removeFeature(planId: string, featureKey: string): Promise<ChangeResult> {
    if (!(await this.prisma.plan.findUnique({ where: { id: planId }, select: { id: true } }))) return 'no_plan';
    const { count } = await this.prisma.planFeature.deleteMany({ where: { planId, featureKey } });
    return count > 0 ? 'changed' : 'unchanged';
  }

  async setUserPlan(userId: string, planId: string): Promise<ChangeResult | 'no_user'> {
    if (!(await this.prisma.plan.findUnique({ where: { id: planId }, select: { id: true } }))) return 'no_plan';
    const user = await this.prisma.appUser.findUnique({ where: { id: userId }, select: { planId: true } });
    if (!user) return 'no_user';
    if (user.planId === planId) return 'unchanged';
    await this.prisma.appUser.update({ where: { id: userId }, data: { planId } });
    return 'changed';
  }
}
