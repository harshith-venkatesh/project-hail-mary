const { createLogger, format, transports } = require('winston');
const { nodeEnv, logLevel } = require('./env');

const logger = createLogger({
  level: logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    nodeEnv === 'production'
      ? format.json()
      : format.printf(({ timestamp, level, message, stack }) => {
          return stack
            ? `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
            : `${timestamp} [${level.toUpperCase()}]: ${message}`;
        }),
  ),
  transports: [new transports.Console()],
});

module.exports = logger;
