import { describe, expect, it } from 'vitest';
import { LOG_LEVELS } from '../../../src/config/env.schema';
import { nestLogLevels } from '../../../src/logging/nest-log-levels';

describe('nestLogLevels', () => {
  it.each([
    ['fatal', ['fatal']],
    ['error', ['fatal', 'error']],
    ['warn', ['fatal', 'error', 'warn']],
    ['info', ['fatal', 'error', 'warn', 'log']],
    ['debug', ['fatal', 'error', 'warn', 'log', 'debug']],
    ['trace', ['fatal', 'error', 'warn', 'log', 'debug', 'verbose']],
    ['silent', []],
  ] as const)('%s prints %j', (level, expected) => {
    expect(nestLogLevels(level)).toEqual(expected);
  });

  it('knows every level the configuration accepts, and a chosen level always includes errors (except silent)', () => {
    for (const level of LOG_LEVELS) {
      const levels = nestLogLevels(level);
      if (level === 'silent') expect(levels).toEqual([]);
      else expect(levels).toContain('fatal');
      if (level !== 'silent' && level !== 'fatal') expect(levels).toContain('error');
    }
  });

  it('gives a new array each time (a caller cannot change the next answer)', () => {
    nestLogLevels('info').push('verbose');
    expect(nestLogLevels('info')).toHaveLength(4);
  });
});
