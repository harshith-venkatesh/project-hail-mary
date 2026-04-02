const { createServer } = require('http');
const app = require('./src/app');
const attachSocket = require('./src/socket');
const { port } = require('./src/config/env');
const logger = require('./src/config/logger');

const httpServer = createServer(app);
attachSocket(httpServer);

httpServer.listen(port, () => {
  logger.info(`Server running on port ${port} (HTTP + WebSocket)`);
});
