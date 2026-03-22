import dotenv from 'dotenv';
import app from './app';
import logger from './logger';

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutdown initiated');

  server.close((err) => {
    if (err) {
      logger.error(err, 'Error during server close');
      process.exit(1);
    }

    logger.info('Server closed gracefully');
    process.exit(0);
  });

  setTimeout(() => {
    logger.warn('Forcing shutdown');
    process.exit(1);
  }, Number(process.env.SHUTDOWN_TIMEOUT_MS) || 30_000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));