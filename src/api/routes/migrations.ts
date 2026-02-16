import { Hono } from 'hono';
import { getDatabase } from '../../db/connection';
import { AppError } from '../middleware/error';
import logger from '../../utils/logger';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const migrations = new Hono();
const db = getDatabase();

// Migration file interface
interface MigrationFile {
  name: string;
  up: string;
  down: string;
}

// List all migrations and their status
migrations.get('/', async (c) => {
  try {
    // Get applied migrations from database
    const applied = db.query<{ name: string; applied_at: number }, []>(
      'SELECT name, applied_at FROM _migrations ORDER BY applied_at ASC'
    ).all();

    // Get migration files from disk
    const migrationsDir = join(process.cwd(), 'migrations');
    let files: string[] = [];
    
    try {
      const entries = await readdir(migrationsDir);
      files = entries.filter(f => f.endsWith('.sql')).sort();
    } catch {
      // Migrations directory doesn't exist yet
    }

    const migrationList = files.map(file => {
      const appliedRecord = applied.find(a => a.name === file);
      return {
        name: file,
        applied: !!appliedRecord,
        appliedAt: appliedRecord ? new Date(appliedRecord.applied_at * 1000).toISOString() : null,
      };
    });

    return c.json({
      migrations: migrationList,
      summary: {
        total: files.length,
        applied: applied.length,
        pending: files.length - applied.length,
      },
    });
  } catch (error) {
    logger.error('Failed to list migrations:', error);
    throw new AppError(
      `Failed to list migrations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'MIGRATION_ERROR'
    );
  }
});

// Run pending migrations
migrations.post('/up', async (c) => {
  try {
    const migrationsDir = join(process.cwd(), 'migrations');
    let files: string[] = [];
    
    try {
      const entries = await readdir(migrationsDir);
      files = entries.filter(f => f.endsWith('.sql')).sort();
    } catch {
      // Create migrations directory
      await import('fs/promises').then(fs => fs.mkdir(migrationsDir, { recursive: true }));
    }

    if (files.length === 0) {
      return c.json({ message: 'No migrations to run', applied: [] });
    }

    const applied: string[] = [];

    for (const file of files) {
      // Check if already applied
      const existing = db.query<{ count: number }, [string]>(
        'SELECT COUNT(*) as count FROM _migrations WHERE name = ?'
      ).get(file);

      if (existing && existing.count > 0) {
        continue;
      }

      // Read and execute migration
      const content = await readFile(join(migrationsDir, file), 'utf-8');
      const upSql = parseMigration(content).up;

      if (upSql) {
        // Execute each statement
        const statements = upSql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const stmt of statements) {
          db.run(stmt);
        }

        // Record migration
        db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
        applied.push(file);
        logger.info(`Applied migration: ${file}`);
      }
    }

    return c.json({
      message: applied.length > 0 ? 'Migrations applied successfully' : 'No pending migrations',
      applied,
    });
  } catch (error) {
    logger.error('Failed to run migrations:', error);
    throw new AppError(
      `Failed to run migrations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'MIGRATION_ERROR'
    );
  }
});

// Rollback last migration
migrations.post('/down', async (c) => {
  try {
    // Get last applied migration
    const lastMigration = db.query<{ name: string; applied_at: number }, []>(
      'SELECT name, applied_at FROM _migrations ORDER BY applied_at DESC LIMIT 1'
    ).get();

    if (!lastMigration) {
      return c.json({ message: 'No migrations to rollback' });
    }

    // Read migration file
    const migrationsDir = join(process.cwd(), 'migrations');
    const content = await readFile(join(migrationsDir, lastMigration.name), 'utf-8');
    const downSql = parseMigration(content).down;

    if (downSql) {
      // Execute each statement
      const statements = downSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        db.run(stmt);
      }
    }

    // Remove migration record
    db.run('DELETE FROM _migrations WHERE name = ?', [lastMigration.name]);
    logger.info(`Rolled back migration: ${lastMigration.name}`);

    return c.json({
      message: 'Migration rolled back successfully',
      rolledBack: lastMigration.name,
    });
  } catch (error) {
    logger.error('Failed to rollback migration:', error);
    throw new AppError(
      `Failed to rollback migration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'MIGRATION_ERROR'
    );
  }
});

// Create a new migration file
migrations.post('/create', async (c) => {
  const body = await c.req.json();
  const name = body.name as string;

  if (!name) {
    throw new AppError('Migration name is required', 400, 'VALIDATION_ERROR');
  }

  // Sanitize name
  const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const filename = `${timestamp}_${safeName}.sql`;

  const content = `-- Migration: ${name}
-- Created at: ${new Date().toISOString()}

-- UP
-- Add your UP migration here

-- DOWN
-- Add your DOWN migration here
`;

  try {
    const migrationsDir = join(process.cwd(), 'migrations');
    await import('fs/promises').then(fs => fs.mkdir(migrationsDir, { recursive: true }));
    await writeFile(join(migrationsDir, filename), content);

    logger.info(`Created migration: ${filename}`);

    return c.json({
      message: 'Migration created successfully',
      filename,
      path: `migrations/${filename}`,
    }, 201);
  } catch (error) {
    logger.error('Failed to create migration:', error);
    throw new AppError(
      `Failed to create migration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'MIGRATION_ERROR'
    );
  }
});

// Helper to parse migration file
function parseMigration(content: string): MigrationFile {
  const upMatch = content.match(/--\s*UP\s*\n([\s\S]*?)(?=--\s*DOWN|$)/i);
  const downMatch = content.match(/--\s*DOWN\s*\n([\s\S]*?)$/i);

  return {
    name: '',
    up: upMatch?.[1]?.trim() || '',
    down: downMatch?.[1]?.trim() || '',
  };
}

export default migrations;
