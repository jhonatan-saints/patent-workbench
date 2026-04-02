import dotenv from 'dotenv';
import app from './app';
import logger from './logger';

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '127.0.0.1';

// L-2: warn loudly if exposed beyond localhost in production
if (process.env.NODE_ENV === 'production' && HOST === '0.0.0.0') {
  logger.warn(
    'Server is listening on 0.0.0.0 — ensure a firewall or reverse proxy restricts external access'
  );
}

const server = app.listen(PORT, HOST, () => {
  logger.info({ port: PORT, host: HOST }, `Server running on http://${HOST}:${PORT}`);
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