import { betterAuth } from 'better-auth';
import { Database } from 'bun:sqlite';
import config from './src/config';

const db = new Database(config.databasePath);
const port = config.port.toString();
const host = config.host;
const baseURL = config.betterAuthUrl || `http://${host}:${port}`;

export const auth = betterAuth({
  database: db,
  baseURL,
  secret: config.betterAuthSecret,
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  experimental: {
    joins: true,
  },
  trustedOrigins: [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `http://0.0.0.0:${port}`,
    baseURL,
  ],
});

export default auth;
