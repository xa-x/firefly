import { Hono } from 'hono';
import { getDatabase } from '../../db/connection';
import { AppError } from '../middleware/error';
import logger from '../../utils/logger';
import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const backup = new Hono();
const db = getDatabase();

const BACKUPS_DIR = join(process.cwd(), 'backups');

// List all backups
backup.get('/', async (c) => {
  try {
    await mkdir(BACKUPS_DIR, { recursive: true });
    const files = await readdir(BACKUPS_DIR);
    
    const backups = files
      .filter(f => f.endsWith('.db.gz') || f.endsWith('.json.gz'))
      .map(f => {
        const parts = f.replace(/\.(db|json)\.gz$/, '').split('_');
        const timestamp = parts.slice(0, 2).join('_');
        const type = f.includes('.db.') ? 'database' : 'full';
        
        return {
          filename: f,
          timestamp,
          type,
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return c.json({ backups });
  } catch (error) {
    logger.error('Failed to list backups:', error);
    throw new AppError(
      `Failed to list backups: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'BACKUP_ERROR'
    );
  }
});

// Create backup
backup.post('/create', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const type = body.type || 'database'; // 'database' or 'full'
  const compress = body.compress !== false;

  try {
    await mkdir(BACKUPS_DIR, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const config = await import('../../config');

    if (type === 'database') {
      // Backup just the database file
      const dbPath = config.default.databasePath;
      const dbContent = await readFile(dbPath);
      
      let content = dbContent;
      let filename = `${timestamp}_backup.db`;
      
      if (compress) {
        content = await gzipAsync(dbContent);
        filename += '.gz';
      }

      await writeFile(join(BACKUPS_DIR, filename), content);
      
      logger.info(`Created backup: ${filename}`);
      
      return c.json({
        message: 'Backup created successfully',
        backup: {
          filename,
          type: 'database',
          compressed: compress,
          size: content.length,
        },
      }, 201);
    } else {
      // Full backup (database + metadata)
      const dbPath = config.default.databasePath;
      const dbContent = await readFile(dbPath);
      
      const backupData = {
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        type: 'full',
        database: dbContent.toString('base64'),
        tables: db.query<{ name: string; schema: string }, []>(
          'SELECT name, schema FROM _tables'
        ).all(),
      };

      let content = Buffer.from(JSON.stringify(backupData, null, 2));
      let filename = `${timestamp}_backup.json`;
      
      if (compress) {
        content = await gzipAsync(content);
        filename += '.gz';
      }

      await writeFile(join(BACKUPS_DIR, filename), content);
      
      logger.info(`Created full backup: ${filename}`);
      
      return c.json({
        message: 'Full backup created successfully',
        backup: {
          filename,
          type: 'full',
          compressed: compress,
          size: content.length,
        },
      }, 201);
    }
  } catch (error) {
    logger.error('Failed to create backup:', error);
    throw new AppError(
      `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'BACKUP_ERROR'
    );
  }
});

// Restore from backup
backup.post('/restore/:filename', async (c) => {
  const filename = c.req.param('filename');

  try {
    const filePath = join(BACKUPS_DIR, filename);
    let content = await readFile(filePath);

    // Decompress if needed
    if (filename.endsWith('.gz')) {
      content = await gunzipAsync(content);
    }

    const config = await import('../../config');

    if (filename.includes('.db')) {
      // Database backup
      await writeFile(config.default.databasePath, content);
      
      logger.info(`Restored database from: ${filename}`);
      
      return c.json({
        message: 'Database restored successfully',
        restored: filename,
      });
    } else if (filename.includes('.json')) {
      // Full backup
      const backupData = JSON.parse(content.toString());
      
      // Restore database
      const dbContent = Buffer.from(backupData.database, 'base64');
      await writeFile(config.default.databasePath, dbContent);
      
      logger.info(`Restored full backup from: ${filename}`);
      
      return c.json({
        message: 'Full backup restored successfully',
        restored: filename,
        originalTimestamp: backupData.timestamp,
      });
    }

    throw new AppError('Unknown backup format', 400, 'INVALID_BACKUP');
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Failed to restore backup:', error);
    throw new AppError(
      `Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'BACKUP_ERROR'
    );
  }
});

// Delete backup
backup.delete('/:filename', async (c) => {
  const filename = c.req.param('filename');

  try {
    const filePath = join(BACKUPS_DIR, filename);
    await unlink(filePath);
    
    logger.info(`Deleted backup: ${filename}`);
    
    return c.json({
      message: 'Backup deleted successfully',
      deleted: filename,
    });
  } catch (error) {
    logger.error('Failed to delete backup:', error);
    throw new AppError(
      `Failed to delete backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'BACKUP_ERROR'
    );
  }
});

// Download backup
backup.get('/download/:filename', async (c) => {
  const filename = c.req.param('filename');

  try {
    const filePath = join(BACKUPS_DIR, filename);
    const content = await readFile(filePath);
    
    return new Response(content, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('Failed to download backup:', error);
    throw new AppError(
      `Failed to download backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'BACKUP_ERROR'
    );
  }
});

export default backup;
