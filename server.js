const app = require('./src/app');
const { port } = require('./src/config/env');
const logger = require('./src/config/logger');

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});
