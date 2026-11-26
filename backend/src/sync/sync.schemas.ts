import { z } from 'zod';

export const MAX_MUTATIONS_PER_PUSH = 100;
export const DEFAULT_CHANGES_LIMIT = 200;
export const MAX_CHANGES_LIMIT = 1000;

/** The envelope is strict. What is inside `data` is checked by the resource, so one bad record does not refuse the whole batch. */
export const mutationSchema = z.strictObject({
  mutationId: z.uuid(),
  resource: z.string().min(1).max(40),
  op: z.enum(['put', 'delete']),
  id: z.uuid(),
  data: z.unknown().optional(),
});

export const pushBodySchema = z.strictObject({ mutations: z.array(mutationSchema).min(1).max(MAX_MUTATIONS_PER_PUSH) });
export type PushMutation = z.infer<typeof mutationSchema>;

/** The cursor is a string of digits: a version can outgrow what some clients hold in a JSON number. */
export const changesQuerySchema = z.strictObject({
  cursor: z.string().regex(/^\d{1,15}$/).default('0'),
  limit: z.coerce.number().int().min(1).max(MAX_CHANGES_LIMIT).default(DEFAULT_CHANGES_LIMIT),
});
