import { z } from 'zod';

/**
 * @typedef {Object} AppConfig
 * @property {number} port - HTTP server listening port
 * @property {'development' | 'production' | 'test'} nodeEnv - Node runtime environment
 * @property {'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'} logLevel - Pino logging severity
 * @property {string} ollamaBaseUrl - Base URL for the Ollama instance
 * @property {string} ollamaModel - Default model name for Ollama
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
  OLLAMA_BASE_URL: z
    .string()
    .url({ message: 'OLLAMA_BASE_URL must be a valid URL' })
    .default('http://localhost:11434')
    .transform((val) => val.replace(/\/+$/, '')),
  OLLAMA_LLM_QWEN3_8B: z
    .string()
    .min(1, { message: 'OLLAMA_LLM_QWEN3_8B cannot be empty' })
    .default('qwen3:8b')
    .transform((val) => val.trim()),
  OLLAMA_EMBEDDING_BGE_M3: z.string().optional(),
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
    ollamaBaseUrl: parsed.data.OLLAMA_BASE_URL,
    ollamaModel: parsed.data.OLLAMA_LLM_QWEN3_8B,
    appToday: parsed.data.APP_TODAY,
    embedModel: parsed.data.OLLAMA_EMBEDDING_BGE_M3 || 'bge-m3:latest',
  });
}

export const config = loadConfig();
