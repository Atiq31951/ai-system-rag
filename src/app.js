import express from 'express';
import { requestId } from './middleware/request-id.js';
// import { httpLogger } from './middleware/http-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { NotFoundError } from './infrastructure/errors.js';
import { healthRoutes } from './modules/health/health.routes.js';

/**
 * Creates and configures the Express application instance.
 * Decoupled from HTTP listener for easy testing.
 *
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express();

  // Observability & tracing (must be first so all requests have an ID)
  app.use(requestId);
  // app.use(httpLogger);

  // Basic security and parsing
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Application routes
  app.use('/health', healthRoutes);
  app.get('/home', (_req, res) => {
    res.json({ message: 'Hello World' });
  });

  // Fallback 404 for unhandled routes
  app.use((req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Central error handling
  app.use(errorHandler);

  return app;
}
