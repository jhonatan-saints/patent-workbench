import pino from 'pino';
import path from 'node:path';

const level = process.env.LOG_LEVEL || 'info';
const logsDir = process.env.LOGS_DIR;

export const logger = logsDir
  ? pino({ level }, pino.destination(path.join(logsDir, 'server.log')))
  : pino({
      level,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    });

export default logger;