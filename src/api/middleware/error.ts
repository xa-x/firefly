import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import logger from '../../utils/logger';

export class AppError extends Error {
  override message: string;
  statusCode: number;
  code: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'APP_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
    this.message = message;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorHandler(err: Error, c: Context) {
  logger.error('Error occurred:', err);

  // Handle HTTPException from Hono
  if (err instanceof HTTPException) {
    return c.json({
      error: {
        message: err.message,
        code: 'HTTP_ERROR',
        status: err.status,
      },
    }, err.status);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return c.json({
      error: {
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: err.issues,
        status: 400,
      },
    }, 400);
  }

  // Handle our custom AppError
  if (err instanceof AppError) {
    return c.json({
      error: {
        message: err.message,
        code: err.code,
        status: err.statusCode,
      },
    }, err.statusCode as 400 | 401 | 403 | 404 | 500);
  }

  // Handle SQLite errors
  if (err.message.includes('SQLITE_') || err.message.includes('sqlite')) {
    return c.json({
      error: {
        message: 'Database error',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
        status: 500,
      },
    }, 500);
  }

  // Generic error
  return c.json({
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
      code: 'INTERNAL_ERROR',
      status: 500,
    },
  }, 500);
}

export default errorHandler;
