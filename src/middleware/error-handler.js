import { ZodError } from 'zod';
import { AppError } from '../infrastructure/errors.js';
// import { logger } from '../infrastructure/logger.js';
import { config } from '../config/index.js';

/**
 * Central Express error-handling middleware.
 * Formats errors into a predictable JSON structure and ensures no stack traces leak in production.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, req, res, _next) {
  // const reqLogger = req.log || logger;

  // 1. Zod runtime validation errors
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    // reqLogger.warn({ err, details }, 'Validation error');
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details,
        requestId: req.id,
      },
    });
  }

  // 2. Custom operational application errors
  if (err instanceof AppError) {
    /*
    if (err.statusCode >= 500) {
      reqLogger.error({ err }, `Application operational error: ${err.message}`);
    } else {
      reqLogger.warn({ err }, `Client error: ${err.message}`);
    }
    */

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.id,
      },
    });
  }

  // 3. SyntaxError (e.g. malformed JSON body from express.json)
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    // reqLogger.warn({ err }, 'Malformed JSON in request body');
    return res.status(400).json({
      error: {
        code: 'MALFORMED_JSON',
        message: 'Request body contains invalid JSON',
        details: null,
        requestId: req.id,
      },
    });
  }

  // 4. Programmer bugs or unexpected system errors (fail-safe)
  // reqLogger.error({ err }, `Unhandled internal error: ${err.message}`);

  const isProduction = config.nodeEnv === 'production';
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      details: null,
      requestId: req.id,
    },
  });
}
