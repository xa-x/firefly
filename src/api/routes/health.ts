import { Hono } from 'hono';
import { getDatabase } from '../../db/connection';

const health = new Hono();

health.get('/', (c) => {
  try {
    // Test database connection
    const db = getDatabase();
    const result = db.query<{ count: number }, []>('SELECT 1 as count').get();
    
    return c.json({
      status: 'ok',
      database: result ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      status: 'error',
      database: 'error',
      timestamp: new Date().toISOString(),
    }, 503);
  }
});

export default health;
