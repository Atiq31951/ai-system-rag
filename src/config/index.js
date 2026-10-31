import { z } from 'zod';

/**
 * @typedef {Object} AppConfig
 * @property {number} port - HTTP server listening port
 * @property {'development' | 'production' | 'test'} nodeEnv - Node runtime environment
 * @property {'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'} logLevel - Pino logging severity
 */

const envSchema = z.object({
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val < 65536, {
      message: 'PORT must be a valid port number between 1 and 65535',
    }),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

/**
 * Validates process.env and returns frozen configuration object.
 * Fails fast on application startup if invalid.
 *
 * @returns {AppConfig}
 */
export function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }

  return Object.freeze({
    port: parsed.data.PORT,
    nodeEnv: parsed.data.NODE_ENV,
    logLevel: parsed.data.LOG_LEVEL,
  });
}

export const config = loadConfig();
