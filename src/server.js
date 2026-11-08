import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';

import { createApp } from './app.js';
import { config } from './config/index.js';
// import { logger } from './infrastructure/logger.js';

import { initChatSocket } from './modules/chat/chat.socket.js';

const app = createApp();
const server = createServer(app);

const io = new SocketIOServer(server);
initChatSocket(io);

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  // logger.info({ port: config.port, env: config.nodeEnv }, 'Server started successfully');
});

/**
 * Handles graceful shutdown on receiving termination signals.
 *
 * @param {'SIGTERM' | 'SIGINT'} signal
 */
function handleShutdown(signal) {
  // logger.info({ signal }, `Received ${signal}, initiating graceful shutdown...`);

  // Stop accepting new incoming HTTP connections
  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err);
      // logger.error({ err }, 'Error during server close');
      process.exit(1);
    }
    console.log('HTTP server closed, exiting cleanly.');
    // logger.info('HTTP server closed, exiting cleanly.');
    process.exit(0);
  });

  // Immediately close idle HTTP keep-alive connections so the server doesn't hang waiting for inactive clients
  server.closeIdleConnections();

  // Force close all remaining connections and exit after 10s if active long-lived requests hang
  const timer = setTimeout(() => {
    console.error('Graceful shutdown timed out after 10s. Forcing exit.');
    // logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
    server.closeAllConnections();
    process.exit(1);
  }, 10000);

  // Unref timer so it doesn't hold the event loop alive if everything else closed
  if (timer.unref) {
    timer.unref();
  }

  io.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
  // logger.fatal({ err: reason }, 'Unhandled Promise Rejection detected');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // logger.fatal({ err }, 'Uncaught Exception detected');
  process.exit(1);
});
