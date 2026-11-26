import { describe, expect, it } from 'vitest';
import { FEATURES } from '../../../src/plans/features';
import { EntitlementsService } from '../../../src/plans/entitlements.service';
import { InMemoryPlanRepository } from '../../support/fakes';

const setup = () => {
  const plans = new InMemoryPlanRepository();
  plans.knownUsers.add('u1');
  return { plans, service: new EntitlementsService(plans) };
};

describe('EntitlementsService', () => {
  it('should_return_null_when_the_person_does_not_exist', async () => {
    const { service } = setup();
    expect(await service.forUser('nobody')).toBeNull();
  });

  it('should_report_false_for_every_feature_when_the_person_does_not_exist', async () => {
    const { service } = setup();
    for (const key of FEATURES) expect(await service.has('nobody', key)).toBe(false);
  });

  it('should_list_the_whole_catalogue_with_every_feature_off_when_the_person_is_on_the_free_plan', async () => {
    const { service } = setup();
    const e = await service.forUser('u1');
    expect(e?.plan).toEqual({ id: 'free', name: 'Free' });
    expect(e?.isAdmin).toBe(false);
    expect(Object.keys(e!.features).sort()).toEqual([...FEATURES].sort());
    expect(Object.values(e!.features).every((on) => on === false)).toBe(true);
  });

  it('should_turn_on_exactly_the_granted_features_when_the_person_is_on_the_pro_plan', async () => {
    const { plans, service } = setup();
    await plans.setUserPlan('u1', 'pro');
    await plans.removeFeature('pro', 'budgets.advanced');
    const e = await service.forUser('u1');
    expect(e?.plan).toEqual({ id: 'pro', name: 'Pro' });
    expect(e?.features).toEqual({ 'budgets.advanced': false, 'import.bank-files': true, 'investments.projection': true, 'report.monthly': true });
  });

  it('should_ignore_a_feature_that_is_not_in_the_catalogue_when_a_plan_holds_one', async () => {
    const { plans, service } = setup();
    await plans.addFeature('free', 'made.up');
    expect(Object.keys((await service.forUser('u1'))!.features)).not.toContain('made.up');
  });

  it('should_pass_the_admin_flag_through_when_the_person_is_an_admin', async () => {
    const { plans, service } = setup();
    plans.admins.add('u1');
    expect((await service.forUser('u1'))?.isAdmin).toBe(true);
  });

  it('should_see_a_change_on_the_next_call_when_a_feature_is_turned_on_or_off', async () => {
    const { plans, service } = setup();
    await plans.setUserPlan('u1', 'pro');
    expect(await service.has('u1', 'report.monthly')).toBe(true);
    await plans.removeFeature('pro', 'report.monthly');
    expect(await service.has('u1', 'report.monthly')).toBe(false);
    await plans.addFeature('pro', 'report.monthly');
    expect(await service.has('u1', 'report.monthly')).toBe(true);
  });
});
