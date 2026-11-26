import { describe, expect, it } from 'vitest';
import { type PlanRepository } from '../../src/plans/plan.repository';

export interface PlanRepositoryHarness {
  readonly repository: PlanRepository;
  newUserId(): Promise<string>;
  /** Makes (or stops) a person being an administrator, the way an operator would: outside the API. */
  setAdmin(userId: string, isAdmin: boolean): Promise<void>;
}

const KEY = 'contract.test-feature';

/** What every PlanRepository must do. Plans "free" and "pro" exist as the migration seeds them. */
export function planRepositoryContract(label: string, harness: () => Promise<PlanRepositoryHarness>) {
  describe(`PlanRepository contract: ${label}`, () => {
    it('everybody starts on free, as not an administrator', async () => {
      const { repository, newUserId } = await harness();
      expect(await repository.planOf(await newUserId())).toEqual({ planId: 'free', planName: 'Free', isAdmin: false });
    });

    it('does not know a person who does not exist', async () => {
      const { repository } = await harness();
      expect(await repository.planOf('019f0000-0000-7000-8000-000000000000')).toBeNull();
    });

    it('lists the plans with their features, in a stable order', async () => {
      const { repository } = await harness();
      const plans = await repository.listPlans();
      expect(plans.map((p) => p.id)).toEqual(expect.arrayContaining(['free', 'pro']));
      expect([...plans.map((p) => p.id)].sort()).toEqual(plans.map((p) => p.id));
      const pro = plans.find((p) => p.id === 'pro')!;
      expect(pro.name).toBe('Pro');
      expect([...pro.features].sort()).toEqual(pro.features);
      expect(pro.features.length).toBeGreaterThan(0);
    });

    it('turns a feature on and off, and repeating either changes nothing', async () => {
      const { repository } = await harness();
      try {
        expect(await repository.addFeature('free', KEY)).toBe('changed');
        expect(await repository.addFeature('free', KEY)).toBe('unchanged');
        expect(await repository.featuresOf('free')).toContain(KEY);
        expect(await repository.removeFeature('free', KEY)).toBe('changed');
        expect(await repository.removeFeature('free', KEY)).toBe('unchanged');
        expect(await repository.featuresOf('free')).not.toContain(KEY);
      } finally {
        await repository.removeFeature('free', KEY);
      }
    });

    it('a feature of one plan is not a feature of another', async () => {
      const { repository } = await harness();
      try {
        await repository.addFeature('free', KEY);
        expect(await repository.featuresOf('pro')).not.toContain(KEY);
      } finally {
        await repository.removeFeature('free', KEY);
      }
    });

    it('says so when the plan does not exist, and creates nothing', async () => {
      const { repository } = await harness();
      expect(await repository.addFeature('nope', KEY)).toBe('no_plan');
      expect(await repository.removeFeature('nope', KEY)).toBe('no_plan');
      expect(await repository.featuresOf('nope')).toEqual([]);
      expect((await repository.listPlans()).map((p) => p.id)).not.toContain('nope');
    });

    it('moves a person to a plan, and back', async () => {
      const { repository, newUserId } = await harness();
      const user = await newUserId();
      expect(await repository.setUserPlan(user, 'pro')).toBe('changed');
      expect(await repository.planOf(user)).toMatchObject({ planId: 'pro', planName: 'Pro' });
      expect(await repository.setUserPlan(user, 'pro')).toBe('unchanged');
      expect(await repository.setUserPlan(user, 'free')).toBe('changed');
      expect(await repository.planOf(user)).toMatchObject({ planId: 'free' });
    });

    it('moving one person does not move another', async () => {
      const { repository, newUserId } = await harness();
      const [a, b] = [await newUserId(), await newUserId()];
      await repository.setUserPlan(a, 'pro');
      expect(await repository.planOf(b)).toMatchObject({ planId: 'free' });
    });

    it('refuses an unknown plan or an unknown person without changing anything', async () => {
      const { repository, newUserId } = await harness();
      const user = await newUserId();
      expect(await repository.setUserPlan(user, 'nope')).toBe('no_plan');
      expect(await repository.planOf(user)).toMatchObject({ planId: 'free' });
      expect(await repository.setUserPlan('019f0000-0000-7000-8000-000000000000', 'pro')).toBe('no_user');
    });

    it('knows who is an administrator, and notices when it is taken away', async () => {
      const { repository, newUserId, setAdmin } = await harness();
      const user = await newUserId();
      await setAdmin(user, true);
      expect((await repository.planOf(user))?.isAdmin).toBe(true);
      await setAdmin(user, false);
      expect((await repository.planOf(user))?.isAdmin).toBe(false);
    });
  });
}
