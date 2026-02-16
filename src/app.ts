import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { errorHandler } from './api/middleware/error';
import healthRoute from './api/routes/health';
import tablesRoute from './api/routes/tables';
import recordsRoute from './api/routes/records';
import migrationsRoute from './api/routes/migrations';
import backupRoute from './api/routes/backup';
import { auth } from '../auth';

// Type definitions for context
type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

const app = new Hono<{ Variables: Variables }>();

// Middleware
app.use('*', honoLogger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Better Auth handler - mount at /api/auth/*
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw);
});

// Session middleware - adds user/session to context
app.use('*', async (c, next) => {
  const session = await auth.api.getSession({ 
    headers: c.req.raw.headers 
  });

  if (!session) {
    c.set('user', null);
    c.set('session', null);
  } else {
    c.set('user', session.user);
    c.set('session', session.session);
  }

  await next();
});

// Health check route
app.route('/health', healthRoute);

// Migration routes
app.route('/api/migrations', migrationsRoute);

// Backup routes
app.route('/api/backup', backupRoute);

// Table management routes
app.route('/api/tables', tablesRoute);

// Record CRUD routes (must be after tables)
app.route('/api', recordsRoute);

// Protected session route - get current user
app.get('/api/session', async (c) => {
  const user = c.get('user');
  const session = c.get('session');

  if (!user) {
    return c.json({
      error: {
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
        status: 401,
      },
    }, 401);
  }

  return c.json({
    user,
    session,
  });
});

// API info
app.get('/', (c) => {
  return c.json({
    name: 'Firefly',
    version: '0.1.0',
    description: 'Lightweight backend-as-a-service',
    endpoints: {
      health: 'GET /health',
      auth: {
        signUp: 'POST /api/auth/sign-up/email',
        signIn: 'POST /api/auth/sign-in/email',
        signOut: 'POST /api/auth/sign-out',
        session: 'GET /api/auth/session',
      },
      session: 'GET /api/session',
      tables: {
        list: 'GET /api/tables',
        get: 'GET /api/tables/:name',
        create: 'POST /api/tables',
        drop: 'DELETE /api/tables/:name',
      },
      records: {
        list: 'GET /api/:table/records',
        get: 'GET /api/:table/records/:id',
        create: 'POST /api/:table/records',
        update: 'PATCH /api/:table/records/:id',
        delete: 'DELETE /api/:table/records/:id',
      },
      migrations: {
        list: 'GET /api/migrations',
        create: 'POST /api/migrations/create',
        up: 'POST /api/migrations/up',
        down: 'POST /api/migrations/down',
      },
      backup: {
        list: 'GET /api/backup',
        create: 'POST /api/backup/create',
        restore: 'POST /api/backup/restore/:filename',
        download: 'GET /api/backup/download/:filename',
        delete: 'DELETE /api/backup/:filename',
      },
    },
    queryExamples: {
      filter: '?where=status:eq:active',
      select: '?select=id,name,email',
      order: '?order=created_at:desc',
      paginate: '?limit=10&offset=0',
    },
    filterOperators: ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'like', 'in', 'isnull'],
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: {
      message: 'Not found',
      code: 'NOT_FOUND',
      status: 404,
    },
  }, 404);
});

// Error handler
app.onError(errorHandler);

export function createServer() {
  return app;
}

export default app;
