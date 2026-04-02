/**
 * presenceHandler
 *
 * Handles socket lifecycle events for user presence and typing indicators.
 *
 * Expected client flow:
 *   1. After connecting, client emits `presence:join` with { userId }
 *   2. While composing a message, client emits `presence:typing` with { userId, partnerId }
 *   3. On send or blur, client emits `presence:stop_typing` with { userId, partnerId }
 *   4. On disconnect the socket server cleans up automatically
 *
 * Events broadcast to others:
 *   presence:online        { userId }             — user just came online
 *   presence:offline       { userId }             — user's last socket disconnected
 *   presence:typing        { userId, partnerId }  — userId is typing to partnerId
 *   presence:stop_typing   { userId, partnerId }  — userId stopped typing
 */

const presenceService = require('../../services/PresenceService');
const logger = require('../../config/logger');

function presenceHandler(io, socket) {
  let registeredUserId = null;

  // ── presence:join ──────────────────────────────────────────────────────
  socket.on('presence:join', ({ userId } = {}) => {
    if (!userId) {
      return socket.emit('error', { message: 'presence:join requires userId' });
    }

    registeredUserId = userId;
    const wasOffline = !presenceService.isOnline(userId);
    presenceService.connect(userId, socket.id);

    // Join a personal room so other users can target this user directly
    socket.join(`user:${userId}`);

    logger.info(`Socket ${socket.id} joined as user ${userId}`);

    // Acknowledge with current online list
    socket.emit('presence:online_list', { onlineUserIds: presenceService.onlineUserIds() });

    // Broadcast to everyone else only if this is a new online event
    if (wasOffline) {
      socket.broadcast.emit('presence:online', { userId });
    }
  });

  // ── presence:typing ────────────────────────────────────────────────────
  socket.on('presence:typing', ({ userId, partnerId } = {}) => {
    if (!userId || !partnerId) {
      return socket.emit('error', { message: 'presence:typing requires userId and partnerId' });
    }

    presenceService.startTyping(userId, partnerId);

    // Deliver only to the partner's personal room
    io.to(`user:${partnerId}`).emit('presence:typing', { userId, partnerId });
  });

  // ── presence:stop_typing ───────────────────────────────────────────────
  socket.on('presence:stop_typing', ({ userId, partnerId } = {}) => {
    if (!userId || !partnerId) {
      return socket.emit('error', { message: 'presence:stop_typing requires userId and partnerId' });
    }

    presenceService.stopTyping(userId, partnerId);
    io.to(`user:${partnerId}`).emit('presence:stop_typing', { userId, partnerId });
  });

  // ── disconnect ─────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    if (!registeredUserId) {
      return;
    }

    const wentOffline = presenceService.disconnect(registeredUserId, socket.id);
    logger.info(`Socket ${socket.id} disconnected (${reason}). User ${registeredUserId} offline=${wentOffline}`);

    if (wentOffline) {
      socket.broadcast.emit('presence:offline', { userId: registeredUserId });
    }
  });
}

module.exports = presenceHandler;
