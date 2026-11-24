import { type LogLevel } from '@nestjs/common';
import { type LOG_LEVELS } from '../config/env.schema';

const ORDER: readonly LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

/** LOG_LEVEL (fatal..trace, silent) to the list of levels NestJS prints: the chosen one and everything more severe. */
export function nestLogLevels(level: (typeof LOG_LEVELS)[number]): LogLevel[] {
  if (level === 'silent') return [];
  const wanted: LogLevel = level === 'info' ? 'log' : level === 'trace' ? 'verbose' : level;
  return ORDER.slice(0, ORDER.indexOf(wanted) + 1);
}
