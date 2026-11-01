import { createApp } from './app.js';
import { config } from './config/index.js';
// import { logger } from './infrastructure/logger.js';

const app = createApp();

const server = app.listen(config.port, () => {
  // logger.info({ port: config.port, env: config.nodeEnv }, 'Server started successfully');
});

/**
 * Handles graceful shutdown on receiving termination signals.
 *
 * @param {'SIGTERM' | 'SIGINT'} signal
 */
function handleShutdown(_signal) {
  // logger.info({ signal: _signal }, `Received ${_signal}, initiating graceful shutdown...`);

  // Stop accepting new incoming HTTP connections
  server.close((err) => {
    if (err) {
      // logger.error({ err }, 'Error during server close');
      process.exit(1);
    }
    // logger.info('HTTP server closed, exiting cleanly.');
    process.exit(0);
  });

  // Immediately close idle HTTP keep-alive connections so the server doesn't hang waiting for inactive clients
  server.closeIdleConnections();

  // Force close all remaining connections and exit after 10s if active long-lived requests hang
  const timer = setTimeout(() => {
    // logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
    server.closeAllConnections();
    process.exit(1);
  }, 10000);

  // Unref timer so it doesn't hold the event loop alive if everything else closed
  if (timer.unref) {
    timer.unref();
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (_reason) => {
  // logger.fatal({ err: _reason }, 'Unhandled Promise Rejection detected');
  process.exit(1);
});

process.on('uncaughtException', (_err) => {
  // logger.fatal({ err: _err }, 'Uncaught Exception detected');
  process.exit(1);
});
