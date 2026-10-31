import { pinoHttp } from 'pino-http';
import { logger } from '../infrastructure/logger.js';
import { REQUEST_ID_HEADER } from './request-id.js';

/**
 * Express HTTP request/response logger middleware.
 * Automatically ties Pino log records to req.id and logs completion status.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id || req.headers[REQUEST_ID_HEADER],
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} completed with ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} failed with ${res.statusCode}: ${err.message}`,
});
