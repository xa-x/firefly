// This file is used ONLY for better-auth CLI migrations
// The main app uses auth.ts with bun:sqlite
import { betterAuth } from 'better-auth';
import Database from 'better-sqlite3';
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
  experimental: {
    joins: true,
  },
});

export default auth;
