/**
 * The features that can be locked behind a plan. The list lives in code, because code is what checks it; which plan has which
 * feature lives in the database (plan_feature), so the owner can change it without a deploy. A key found in the database that
 * is not in this list is ignored, and the admin routes refuse to add one.
 *
 * Starting names, to be confirmed by the product owner. A route that needs one uses @RequiresFeature('<key>').
 */
export const FEATURES = ['budgets.advanced', 'import.bank-files', 'investments.projection', 'report.monthly'] as const;

export type FeatureKey = (typeof FEATURES)[number];

export const isFeatureKey = (value: unknown): value is FeatureKey => typeof value === 'string' && (FEATURES as readonly string[]).includes(value);
