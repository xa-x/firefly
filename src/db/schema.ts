import { z } from 'zod';

export const columnTypes = [
  'text',
  'integer',
  'real',
  'boolean',
  'json',
  'timestamp',
] as const;

export const columnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(columnTypes),
  nullable: z.boolean().default(true),
  primaryKey: z.boolean().default(false),
  autoIncrement: z.boolean().default(false),
  unique: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
});

export const tableSchema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, 'Table name must be lowercase and start with letter'),
  columns: z.array(columnSchema).min(1),
  indexes: z.array(z.object({
    name: z.string(),
    columns: z.array(z.string()),
    unique: z.boolean().default(false),
  })).optional(),
});

export type Column = z.infer<typeof columnSchema>;
export type Table = z.infer<typeof tableSchema>;
export type ColumnType = z.infer<typeof columnSchema>['type'];

// Map our types to SQLite types
export function toSqliteType(type: ColumnType): string {
  switch (type) {
    case 'text':
      return 'TEXT';
    case 'integer':
      return 'INTEGER';
    case 'real':
      return 'REAL';
    case 'boolean':
      return 'INTEGER';
    case 'json':
      return 'TEXT';
    case 'timestamp':
      return 'INTEGER';
    default:
      return 'TEXT';
  }
}

export default {
  columnTypes,
  columnSchema,
  tableSchema,
  toSqliteType,
};
