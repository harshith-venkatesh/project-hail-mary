/**
 * messageHandler
 *
 * Handles real-time message events over WebSocket.
 * This works alongside (not instead of) the HTTP REST endpoints.
 *
 * Client → Server events:
 *   message:send           { senderId, receiverId, content, clientRequestId? }
 *   message:delivered      { messageId, receiverId }   — client acks delivery
 *   message:read           { messageId, receiverId }   — client acks read
 *
 * Server → Client events (delivered to receiver's personal room):
 *   message:new            { message }                 — new inbound message
 *   message:status_updated { messageId, status }       — delivery/read receipt
 *   error                  { message }                 — operation failed
 */

const messageFeedService = require('../../services/MessageFeedService');
const Message = require('../../models/Message');
const logger = require('../../config/logger');

function messageHandler(io, socket) {
  // ── message:send ───────────────────────────────────────────────────────
  socket.on('message:send', async ({ senderId, receiverId, content, clientRequestId } = {}) => {
    if (!senderId || !receiverId || !content) {
      return socket.emit('error', { message: 'message:send requires senderId, receiverId, content' });
    }

    try {
      const message = await messageFeedService.send({
        senderId,
        receiverId,
        content,
        clientRequestId,
      });

      // Confirm to sender
      socket.emit('message:sent', { message });

      // Deliver to all of receiver's connected sockets
      io.to(`user:${receiverId}`).emit('message:new', { message });

      logger.info(`Message ${message.id} sent from ${senderId} to ${receiverId}`);
    } catch (err) {
      logger.error(`message:send failed: ${err.message}`);
      socket.emit('error', { message: err.message });
    }
  });

  // ── message:delivered ──────────────────────────────────────────────────
  socket.on('message:delivered', async ({ messageId, receiverId } = {}) => {
    if (!messageId || !receiverId) {
      return socket.emit('error', { message: 'message:delivered requires messageId and receiverId' });
    }

    try {
      const message = await messageFeedService.updateStatus(messageId, Message.STATUS.DELIVERED);

      // Notify the original sender that their message was delivered
      io.to(`user:${message.senderId}`).emit('message:status_updated', {
        messageId: message.id,
        status: message.status,
      });
    } catch (err) {
      logger.error(`message:delivered failed: ${err.message}`);
      socket.emit('error', { message: err.message });
    }
  });

  // ── message:read ───────────────────────────────────────────────────────
  socket.on('message:read', async ({ messageId } = {}) => {
    if (!messageId) {
      return socket.emit('error', { message: 'message:read requires messageId' });
    }

    try {
      const message = await messageFeedService.updateStatus(messageId, Message.STATUS.READ);

      // Notify the original sender that their message was read
      io.to(`user:${message.senderId}`).emit('message:status_updated', {
        messageId: message.id,
        status: message.status,
      });
    } catch (err) {
      logger.error(`message:read failed: ${err.message}`);
      socket.emit('error', { message: err.message });
    }
  });
}

module.exports = messageHandler;
