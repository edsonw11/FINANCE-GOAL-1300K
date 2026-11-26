import { z } from 'zod';

export const ACCOUNT_NAME_MAX = 80;

/** Half of an emoji or a similar pair, alone: JSON allows it, PostgreSQL's UTF-8 does not. (No `u` flag, so surrogates are seen one by one.) */
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

/** The id comes from the device (ADR-0008), so it is checked: a UUID, nothing else reaches the database. */
export const accountIdSchema = z.uuid();

/** Control characters (a NUL would make PostgreSQL fail) and broken UTF-16 are refused; only `name` is accepted. */
export const accountBodySchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(ACCOUNT_NAME_MAX)
    .refine((name) => !/[\u0000-\u001f\u007f]/.test(name), 'control characters are not allowed')
    .refine((name) => !LONE_SURROGATE.test(name), 'invalid text'),
});
