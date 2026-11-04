import pino from 'pino';
import { config } from '../config/index.js';

const isDev = config.nodeEnv === 'development';

/**
 * Shared Pino structured logger instance.
 * In development, uses pino-pretty transport if available.
 * In production/test, outputs high-throughput single-line NDJSON.
 */
export const logger = pino({
  level: config.logLevel || 'info',
  transport: isDev
    ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    }
    : undefined,
  base: {
    env: config.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
