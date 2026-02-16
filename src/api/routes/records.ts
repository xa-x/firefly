import { Hono } from 'hono';
import { z } from 'zod';
import { getDatabase } from '../../db/connection';
import { AppError } from '../middleware/error';
import logger from '../../utils/logger';

const records = new Hono<{ Variables: { user: unknown } }>();
const db = getDatabase();

// Query params schema
const queryParamsSchema = z.object({
  select: z.string().optional(),
  where: z.string().optional(),
  order: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
});

// List records from a table
records.get('/:table/records', async (c) => {
  const tableName = c.req.param('table');
  const params = queryParamsSchema.safeParse(c.req.query());

  if (!params.success) {
    throw new AppError('Invalid query parameters', 400, 'INVALID_QUERY');
  }

  const { select, where, order, limit, offset } = params.data;

  // Check if table exists
  const tableExists = db.query<{ count: number }, [string]>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tableName);

  if (!tableExists || tableExists.count === 0) {
    throw new AppError(`Table '${tableName}' not found`, 404, 'TABLE_NOT_FOUND');
  }

  try {
    // Build query
    const selectClause = select ? select.split(',').map(s => `"${s.trim()}"`).join(', ') : '*';
    let sql = `SELECT ${selectClause} FROM "${tableName}"`;
    const whereParams: unknown[] = [];

    if (where) {
      const { clause, params: whereParamsParsed } = parseWhereClause(where);
      sql += ` WHERE ${clause}`;
      whereParams.push(...whereParamsParsed);
    }

    if (order) {
      const orderParts = order.split(',').map(o => {
        const [col, dir = 'ASC'] = o.trim().split(':');
        return `"${col}" ${dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
      });
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    }

    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    // Use dynamic query with params array
    const stmt = db.prepare(sql);
    const recordsList = whereParams.length > 0 
      ? stmt.all(...whereParams as []) as Record<string, unknown>[]
      : stmt.all() as Record<string, unknown>[];

    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as count FROM "${tableName}"`;
    const countParams: unknown[] = [];
    if (where) {
      const { clause, params: whereParamsParsed } = parseWhereClause(where);
      countSql += ` WHERE ${clause}`;
      countParams.push(...whereParamsParsed);
    }
    const countStmt = db.prepare(countSql);
    const totalResult = countParams.length > 0
      ? countStmt.get(...countParams as []) as { count: number }
      : countStmt.get() as { count: number };

    return c.json({
      data: recordsList,
      pagination: {
        total: totalResult?.count ?? 0,
        limit,
        offset,
        hasMore: (totalResult?.count ?? 0) > offset + limit,
      },
    });
  } catch (error) {
    logger.error('Failed to query records:', error);
    throw new AppError(
      `Failed to query records: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'QUERY_ERROR'
    );
  }
});

// Get single record by ID
records.get('/:table/records/:id', async (c) => {
  const tableName = c.req.param('table');
  const id = c.req.param('id');

  // Check if table exists
  const tableExists = db.query<{ count: number }, [string]>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tableName);

  if (!tableExists || tableExists.count === 0) {
    throw new AppError(`Table '${tableName}' not found`, 404, 'TABLE_NOT_FOUND');
  }

  try {
    // Try to find by id or _id
    const stmt = db.prepare(`SELECT * FROM "${tableName}" WHERE "id" = ? OR "_id" = ? LIMIT 1`);
    const record = stmt.get(id, id) as Record<string, unknown> | undefined;

    if (!record) {
      throw new AppError('Record not found', 404, 'RECORD_NOT_FOUND');
    }

    return c.json({ data: record });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Failed to get record:', error);
    throw new AppError(
      `Failed to get record: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'QUERY_ERROR'
    );
  }
});

// Create new record(s)
records.post('/:table/records', async (c) => {
  const tableName = c.req.param('table');
  const body = await c.req.json();

  // Check if table exists
  const tableExists = db.query<{ count: number }, [string]>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tableName);

  if (!tableExists || tableExists.count === 0) {
    throw new AppError(`Table '${tableName}' not found`, 404, 'TABLE_NOT_FOUND');
  }

  // Support single or batch insert
  const recordsInput = Array.isArray(body) ? body : [body];
  const results: Record<string, unknown>[] = [];

  try {
    for (const record of recordsInput) {
      const columns = Object.keys(record).map(k => `"${k}"`).join(', ');
      const placeholders = Object.keys(record).map(() => '?').join(', ');
      const values = Object.values(record);

      const sql = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders})`;
      const result = db.run(sql, values as []);

      // Get the inserted record
      if (result.lastInsertRowid) {
        const stmt = db.prepare(`SELECT * FROM "${tableName}" WHERE "rowid" = ?`);
        const inserted = stmt.get(Number(result.lastInsertRowid)) as Record<string, unknown> | undefined;
        if (inserted) results.push(inserted);
      }
    }

    logger.info(`Created ${results.length} record(s) in '${tableName}'`);

    return c.json({
      message: 'Record(s) created successfully',
      data: Array.isArray(body) ? results : results[0],
    }, 201);
  } catch (error) {
    logger.error('Failed to create record:', error);
    throw new AppError(
      `Failed to create record: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'CREATE_ERROR'
    );
  }
});

// Update record
records.patch('/:table/records/:id', async (c) => {
  const tableName = c.req.param('table');
  const id = c.req.param('id');
  const body = await c.req.json();

  // Check if table exists
  const tableExists = db.query<{ count: number }, [string]>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tableName);

  if (!tableExists || tableExists.count === 0) {
    throw new AppError(`Table '${tableName}' not found`, 404, 'TABLE_NOT_FOUND');
  }

  if (Object.keys(body).length === 0) {
    throw new AppError('No fields to update', 400, 'NO_FIELDS');
  }

  try {
    const setClause = Object.keys(body)
      .map(k => `"${k}" = ?`)
      .join(', ');
    const values = [...Object.values(body), id, id];

    const sql = `UPDATE "${tableName}" SET ${setClause} WHERE "id" = ? OR "_id" = ?`;
    const result = db.run(sql, values as []);

    if (result.changes === 0) {
      throw new AppError('Record not found', 404, 'RECORD_NOT_FOUND');
    }

    // Get the updated record
    const stmt = db.prepare(`SELECT * FROM "${tableName}" WHERE "id" = ? OR "_id" = ?`);
    const updated = stmt.get(id, id) as Record<string, unknown> | undefined;

    logger.info(`Updated record '${id}' in '${tableName}'`);

    return c.json({
      message: 'Record updated successfully',
      data: updated,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Failed to update record:', error);
    throw new AppError(
      `Failed to update record: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'UPDATE_ERROR'
    );
  }
});

// Delete record
records.delete('/:table/records/:id', async (c) => {
  const tableName = c.req.param('table');
  const id = c.req.param('id');

  // Check if table exists
  const tableExists = db.query<{ count: number }, [string]>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tableName);

  if (!tableExists || tableExists.count === 0) {
    throw new AppError(`Table '${tableName}' not found`, 404, 'TABLE_NOT_FOUND');
  }

  try {
    const sql = `DELETE FROM "${tableName}" WHERE "id" = ? OR "_id" = ?`;
    const result = db.run(sql, [id, id]);

    if (result.changes === 0) {
      throw new AppError('Record not found', 404, 'RECORD_NOT_FOUND');
    }

    logger.info(`Deleted record '${id}' from '${tableName}'`);

    return c.json({
      message: 'Record deleted successfully',
      id,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Failed to delete record:', error);
    throw new AppError(
      `Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'DELETE_ERROR'
    );
  }
});

// Helper to parse where clause
function parseWhereClause(where: string): { clause: string; params: unknown[] } {
  const params: unknown[] = [];
  const conditions: string[] = [];

  // Simple parser for: field:op:value,field:op:value
  // Supported ops: eq, ne, gt, lt, gte, lte, like, in
  const parts = where.split(',');

  for (const part of parts) {
    const [field, op, ...valueParts] = part.split(':');
    const value = valueParts.join(':');
    if (!field || !op || value === undefined) continue;

    const fieldName = `"${field}"`;

    switch (op.toLowerCase()) {
      case 'eq':
        conditions.push(`${fieldName} = ?`);
        params.push(parseValue(value));
        break;
      case 'ne':
        conditions.push(`${fieldName} != ?`);
        params.push(parseValue(value));
        break;
      case 'gt':
        conditions.push(`${fieldName} > ?`);
        params.push(parseValue(value));
        break;
      case 'lt':
        conditions.push(`${fieldName} < ?`);
        params.push(parseValue(value));
        break;
      case 'gte':
        conditions.push(`${fieldName} >= ?`);
        params.push(parseValue(value));
        break;
      case 'lte':
        conditions.push(`${fieldName} <= ?`);
        params.push(parseValue(value));
        break;
      case 'like':
        conditions.push(`${fieldName} LIKE ?`);
        params.push(`%${value}%`);
        break;
      case 'in':
        const values = value.split('|').map(parseValue);
        conditions.push(`${fieldName} IN (${values.map(() => '?').join(', ')})`);
        params.push(...values);
        break;
      case 'isnull':
        conditions.push(value === 'true' ? `${fieldName} IS NULL` : `${fieldName} IS NOT NULL`);
        break;
    }
  }

  return {
    clause: conditions.length > 0 ? conditions.join(' AND ') : '1=1',
    params,
  };
}

function parseValue(value: string): unknown {
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!isNaN(num)) return num;
  return value;
}

export default records;
