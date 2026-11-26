import { describe, expect, it } from 'vitest';
import { ACCOUNT_NAME_MAX, accountBodySchema, accountIdSchema } from '../../../src/accounts/account.schemas';

const name = (value: unknown) => accountBodySchema.safeParse({ name: value });

describe('account id', () => {
  it('should_accept_a_uuid_when_the_device_sends_one', () => {
    expect(accountIdSchema.safeParse('0190a1b2-0000-7000-8000-000000000001').success).toBe(true);
  });

  it('should_refuse_anything_that_is_not_a_uuid_when_it_would_reach_the_database', () => {
    for (const v of ['', '1', 'nu', "'; drop table accounts;--", '0190a1b2-0000-7000-8000-00000000000', 7, null]) expect(accountIdSchema.safeParse(v).success).toBe(false);
  });
});

describe('account body', () => {
  it('should_trim_the_name_when_it_has_spaces_around', () => {
    expect(name('  Nubank  ')).toMatchObject({ success: true, data: { name: 'Nubank' } });
  });

  it('should_accept_accents_and_emoji_when_the_text_is_well_formed', () => {
    expect(name('Poupança 🏦').success).toBe(true);
  });

  it('should_accept_exactly_the_maximum_length_and_refuse_one_more', () => {
    expect(name('a'.repeat(ACCOUNT_NAME_MAX)).success).toBe(true);
    expect(name('a'.repeat(ACCOUNT_NAME_MAX + 1)).success).toBe(false);
  });

  it('should_refuse_an_empty_name_or_one_with_only_spaces', () => {
    expect(name('').success).toBe(false);
    expect(name('   ').success).toBe(false);
  });

  it('should_refuse_control_characters_when_a_nul_would_break_postgresql', () => {
    for (const v of ['a\u0000b', 'a\u001fb', 'a\u007fb', 'a\nb', 'a\tb']) expect(name(v).success).toBe(false);
  });

  it('should_refuse_half_an_emoji_when_postgresql_cannot_store_it', () => {
    expect(name('a\ud83db').success).toBe(false);
    expect(name('a\ude00b').success).toBe(false);
  });

  it('should_refuse_other_fields_when_only_name_is_allowed', () => {
    expect(accountBodySchema.safeParse({ name: 'a', userId: 'x' }).success).toBe(false);
  });

  it('should_refuse_a_missing_or_non_string_name', () => {
    expect(accountBodySchema.safeParse({}).success).toBe(false);
    for (const v of [null, 5, ['a'], { a: 1 }]) expect(name(v).success).toBe(false);
  });
});
