import { serve } from 'bun';
import app from './app';
import config from './config';
import { getDatabase, closeDatabase } from './db/connection';
import logger from './utils/logger';

export function startServer(port: number = config.port, host: string = config.host) {
  // Initialize database connection
  getDatabase();

  const server = serve({
    port,
    hostname: host,
    fetch: app.fetch,
  });

  logger.info(`🚀 Firefly server running at http://${host}:${port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Database: ${config.databasePath}`);

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down server...');
    closeDatabase();
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down server...');
    closeDatabase();
    server.stop();
    process.exit(0);
  });

  return server;
}

// Start server if this is the main module
if (import.meta.main) {
  startServer();
}

export default startServer;
