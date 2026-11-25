export interface UserPlan {
  readonly planId: string;
  readonly planName: string;
  readonly isAdmin: boolean;
}

export interface PlanView {
  readonly id: string;
  readonly name: string;
  readonly features: readonly string[];
}

/** `unchanged` is not an error: asking for what is already true is safe to repeat. */
export type ChangeResult = 'changed' | 'unchanged' | 'no_plan';

export interface PlanRepository {
  planOf(userId: string): Promise<UserPlan | null>;
  featuresOf(planId: string): Promise<string[]>;
  listPlans(): Promise<PlanView[]>;
  addFeature(planId: string, featureKey: string): Promise<ChangeResult>;
  removeFeature(planId: string, featureKey: string): Promise<ChangeResult>;
  setUserPlan(userId: string, planId: string): Promise<ChangeResult | 'no_user'>;
}

export const PLAN_REPOSITORY = Symbol('PLAN_REPOSITORY');
