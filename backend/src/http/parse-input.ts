import { BadRequestException } from '@nestjs/common';
import { type z } from 'zod';

/**
 * Checks what a client sent against a schema. On failure the answer says which field and which kind of problem,
 * never what was received (it can be a secret, or text that should not be echoed back).
 */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: 'Invalid request',
    issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
  });
}
