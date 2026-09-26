// Minimal structured logger. Swap for pino/winston in production if desired.
const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const active = levels[process.env.LOG_LEVEL] ?? levels.info;

function emit(level, msg, meta) {
  if (levels[level] > active) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta } : {}),
  };
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  out(JSON.stringify(line));
}

export const logger = {
  error: (msg, meta) => emit('error', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  debug: (msg, meta) => emit('debug', msg, meta),
};
