import { randomUUID } from 'node:crypto';

import { findUserByToken } from '../../infrastructure/data-store.js';
import { getReply } from './chat.service.js';

/**
 * Initializes chat Socket.IO handlers and authentication middleware.
 *
 * @param {import('socket.io').Server} io
 */
export function initChatSocket(io) {
  // 1. Handshake auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || randomUUID();

    // No token provided -> connect as guest
    if (!token) {
      socket.data.user = null;
      return next();
    }

    // Token provided -> look up user
    const user = await findUserByToken(token);
    if (!user) {
      return next(new Error('Invalid token'));
    }

    // Valid token -> store user object (never the token)
    socket.data.user = { id: user.id, name: user.name, email: user.email, token };
    next();
  });

  // 2. Message event handling
  io.on('connection', (socket) => {
    socket.on('message', async (payload) => {
      const text = payload?.text?.trim();

      if (!text) {
        socket.emit('error', { message: 'Message text cannot be empty' });
        return;
      }

      try {
        const reply = await getReply(text, socket.data.user);
        socket.emit('reply', { text: reply });
      } catch (err) {
        console.error('Error in getReply:', err);
        socket.emit('error', { message: 'Something went wrong' });
      }
    });
  });
}
