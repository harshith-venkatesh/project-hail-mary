/**
 * Socket.io server setup.
 * Attaches to an existing http.Server instance and registers all handlers.
 *
 * Usage:
 *   const { createServer } = require('http');
 *   const app = require('./app');
 *   const attachSocket = require('./socket');
 *   const httpServer = createServer(app);
 *   attachSocket(httpServer);
 *   httpServer.listen(port);
 */

const { Server } = require('socket.io');
const presenceHandler = require('./handlers/presenceHandler');
const messageHandler = require('./handlers/messageHandler');
const logger = require('../config/logger');

function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // tighten this in production
      methods: ['GET', 'POST'],
    },
    // Ping every 25 s, disconnect after 60 s without pong — keeps the
    // online list accurate even when clients close without a clean disconnect.
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    presenceHandler(io, socket);
    messageHandler(io, socket);
  });

  return io;
}

module.exports = attachSocket;
