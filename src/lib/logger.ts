/**
 * Structured logger. JSON in production, pretty in dev.
 * Designed to plug into Azure Application Insights via the telemetry module.
 */
import { env } from './env';

type Level = 'error' | 'warn' | 'info' | 'debug';
const LEVELS: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };

function shouldLog(level: Level): boolean {
  try {
    return LEVELS[level] <= LEVELS[env().LOG_LEVEL];
  } catch {
    return LEVELS[level] <= LEVELS.info;
  }
}

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context || {}),
  };
  const line = process.env.NODE_ENV === 'production' ? JSON.stringify(entry) : prettyFormat(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function prettyFormat(entry: Record<string, unknown>): string {
  const { ts, level, message, ...rest } = entry as { ts: string; level: string; message: string };
  const colour =
    level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : level === 'debug' ? '\x1b[90m' : '\x1b[36m';
  const reset = '\x1b[0m';
  const restStr = Object.keys(rest).length ? ' ' + JSON.stringify(rest) : '';
  return `${colour}[${level.toUpperCase()}]${reset} ${ts} ${message}${restStr}`;
}

export const logger = {
  error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit('info', msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', msg, ctx),
  child: (bindings: Record<string, unknown>) => ({
    error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, { ...bindings, ...ctx }),
    warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', msg, { ...bindings, ...ctx }),
    info: (msg: string, ctx?: Record<string, unknown>) => emit('info', msg, { ...bindings, ...ctx }),
    debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', msg, { ...bindings, ...ctx }),
  }),
};
