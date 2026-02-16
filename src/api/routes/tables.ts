import { Hono } from 'hono';
import { getDatabase } from '../../db/connection';
import { tableSchema, toSqliteType } from '../../db/schema';
import { AppError } from '../middleware/error';
import logger from '../../utils/logger';

const tables = new Hono();
const db = getDatabase();

// List all user tables
tables.get('/', (c) => {
  const tableList = db.query<{
    name: string;
    schema: string;
    created_at: number;
  }, []>(`
    SELECT name, schema, created_at 
    FROM _tables 
    ORDER BY created_at DESC
  `).all();

  return c.json({
    tables: tableList.map(t => ({
      name: t.name,
      schema: JSON.parse(t.schema),
      createdAt: new Date(t.created_at * 1000).toISOString(),
    })),
  });
});

// Get single table info
tables.get('/:name', (c) => {
  const name = c.req.param('name');
  
  const table = db.query<{
    name: string;
    schema: string;
    created_at: number;
  }, [string]>(`
    SELECT name, schema, created_at 
    FROM _tables 
    WHERE name = ?
  `).get(name);

  if (!table) {
    throw new AppError(`Table '${name}' not found`, 404, 'TABLE_NOT_FOUND');
  }

  return c.json({
    name: table.name,
    schema: JSON.parse(table.schema),
    createdAt: new Date(table.created_at * 1000).toISOString(),
  });
});

// Create a new table
tables.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = tableSchema.safeParse(body);

  if (!parsed.success) {
    throw new AppError(`Invalid table schema: ${JSON.stringify(parsed.error.issues)}`, 400, 'VALIDATION_ERROR');
  }

  const tableDef = parsed.data;
  const tableName = tableDef.name;

  // Check if table already exists
  const existing = db.query<{ count: number }, [string]>(
    'SELECT COUNT(*) as count FROM _tables WHERE name = ?'
  ).get(tableName);

  if (existing && existing.count > 0) {
    throw new AppError(`Table '${tableName}' already exists`, 409, 'TABLE_EXISTS');
  }

  // Build CREATE TABLE SQL
  const columnDefs: string[] = [];
  const primaryKeys: string[] = [];

  for (const col of tableDef.columns) {
    let def = `"${col.name}" ${toSqliteType(col.type)}`;
    
    if (col.primaryKey) {
      primaryKeys.push(col.name);
      if (col.autoIncrement) {
        def += ' PRIMARY KEY AUTOINCREMENT';
        columnDefs.push(def);
        continue;
      }
    }
    
    if (col.unique && !col.primaryKey) {
      def += ' UNIQUE';
    }
    
    if (!col.nullable && !col.primaryKey) {
      def += ' NOT NULL';
    }
    
    if (col.defaultValue !== undefined) {
      if (typeof col.defaultValue === 'string') {
        def += ` DEFAULT '${col.defaultValue}'`;
      } else {
        def += ` DEFAULT ${col.defaultValue}`;
      }
    }
    
    columnDefs.push(def);
  }

  // Add composite primary key if multiple
  if (primaryKeys.length > 1) {
    columnDefs.push(`PRIMARY KEY (${primaryKeys.map(k => `"${k}"`).join(', ')})`);
  }

  // Add indexes
  const indexSqls: string[] = [];
  if (tableDef.indexes) {
    for (const idx of tableDef.indexes) {
      const idxName = `idx_${tableName}_${idx.name}`;
      const unique = idx.unique ? 'UNIQUE ' : '';
      const cols = idx.columns.map(c => `"${c}"`).join(', ');
      indexSqls.push(`CREATE ${unique}INDEX IF NOT EXISTS "${idxName}" ON "${tableName}" (${cols})`);
    }
  }

  // Execute CREATE TABLE
  const createSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs.join(', ')})`;
  
  try {
    db.run(createSql);
    
    // Create indexes
    for (const idxSql of indexSqls) {
      db.run(idxSql);
    }

    // Record in _tables
    db.run(
      'INSERT INTO _tables (name, schema) VALUES (?, ?)',
      [tableName, JSON.stringify(tableDef)]
    );

    logger.info(`Table '${tableName}' created`);

    return c.json({
      message: 'Table created successfully',
      table: {
        name: tableName,
        schema: tableDef,
      },
    }, 201);
  } catch (error) {
    logger.error('Failed to create table:', error);
    throw new AppError(
      `Failed to create table: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'TABLE_CREATE_ERROR'
    );
  }
});

// Drop a table
tables.delete('/:name', (c) => {
  const name = c.req.param('name');

  // Check if table exists
  const existing = db.query<{ count: number }, [string]>(
    'SELECT COUNT(*) as count FROM _tables WHERE name = ?'
  ).get(name);

  if (!existing || existing.count === 0) {
    throw new AppError(`Table '${name}' not found`, 404, 'TABLE_NOT_FOUND');
  }

  try {
    // Drop the table
    db.run(`DROP TABLE IF EXISTS "${name}"`);

    // Remove from _tables
    db.run('DELETE FROM _tables WHERE name = ?', [name]);

    logger.info(`Table '${name}' dropped`);

    return c.json({
      message: 'Table dropped successfully',
      name,
    });
  } catch (error) {
    logger.error('Failed to drop table:', error);
    throw new AppError(
      `Failed to drop table: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'TABLE_DROP_ERROR'
    );
  }
});

export default tables;
