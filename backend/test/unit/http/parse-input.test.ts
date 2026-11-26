import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseInput } from '../../../src/http/parse-input';

const schema = z.strictObject({ name: z.string().min(1), qty: z.number().int().min(0) });
const refusal = (value: unknown): BadRequestException => {
  try {
    parseInput(schema, value);
  } catch (e) {
    return e as BadRequestException;
  }
  throw new Error('expected a refusal');
};

describe('parseInput', () => {
  it('should_return_the_parsed_value_when_the_input_is_valid', () => {
    expect(parseInput(schema, { name: 'a', qty: 2 })).toEqual({ name: 'a', qty: 2 });
  });

  it('should_return_the_schema_output_not_the_raw_input_when_the_schema_transforms', () => {
    expect(parseInput(z.string().trim(), '  hi  ')).toBe('hi');
  });

  it('should_throw_a_400_with_the_field_and_the_kind_of_problem_when_the_input_is_invalid', () => {
    const e = refusal({ name: '', qty: 1 });
    expect(e.getStatus()).toBe(400);
    expect(e.getResponse()).toEqual({ statusCode: 400, error: 'Bad Request', message: 'Invalid request', issues: [{ path: 'name', code: 'too_small' }] });
  });

  it('should_list_every_problem_when_several_fields_are_wrong', () => {
    const paths = (refusal({ name: 5, qty: -1 }).getResponse() as { issues: { path: string }[] }).issues.map((i) => i.path).sort();
    expect(paths).toEqual(['name', 'qty']);
  });

  it('should_refuse_an_unknown_field_when_the_schema_is_strict', () => {
    const issues = (refusal({ name: 'a', qty: 1, admin: true }).getResponse() as { issues: { code: string }[] }).issues;
    expect(issues.map((i) => i.code)).toEqual(['unrecognized_keys']);
  });

  it('should_never_echo_what_was_received_when_it_refuses', () => {
    const secret = 'token-s3cr3t-value';
    expect(JSON.stringify(refusal({ name: secret, qty: 'x' }).getResponse())).not.toContain(secret);
  });

  it('should_refuse_null_and_undefined_without_crashing', () => {
    for (const v of [null, undefined, 'text', 7, []]) expect(refusal(v).getStatus()).toBe(400);
  });
});
