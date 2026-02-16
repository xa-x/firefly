import { Database } from 'bun:sqlite';
import config from '../config';
import logger from '../utils/logger';

let db: Database | null = null;

export function getDatabase(): Database {
  if (!db) {
    logger.info(`Connecting to database: ${config.databasePath}`);
    db = new Database(config.databasePath);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    initializeTables(db);
    logger.info('Database connected and initialized');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    logger.info('Closing database connection');
    db.close();
    db = null;
  }
}

function initializeTables(database: Database): void {
  // Internal tables for firefly management
  database.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS _tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      schema TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  logger.debug('Internal tables initialized');
}

export default { getDatabase, closeDatabase };
