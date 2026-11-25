import { Inject, Injectable } from '@nestjs/common';
import { FEATURES, type FeatureKey } from './features';
import { PLAN_REPOSITORY, type PlanRepository } from './plan.repository';

export interface Entitlements {
  readonly plan: { readonly id: string; readonly name: string };
  /** Every feature of the catalogue, true when the person's plan has it. The app shows the false ones with a PRO badge. */
  readonly features: Readonly<Record<FeatureKey, boolean>>;
  readonly isAdmin: boolean;
}

@Injectable()
export class EntitlementsService {
  constructor(@Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository) {}

  /** Read from the database on every call: a change of plan or of a feature counts from the next request. */
  async forUser(userId: string): Promise<Entitlements | null> {
    const plan = await this.plans.planOf(userId);
    if (!plan) return null;
    const granted = new Set(await this.plans.featuresOf(plan.planId));
    const features = Object.fromEntries(FEATURES.map((key) => [key, granted.has(key)])) as Record<FeatureKey, boolean>;
    return { plan: { id: plan.planId, name: plan.planName }, features, isAdmin: plan.isAdmin };
  }

  async has(userId: string, feature: FeatureKey): Promise<boolean> {
    return (await this.forUser(userId))?.features[feature] ?? false;
  }
}
