import { z } from 'zod';
import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import logger from '../utils/logger';

function generateSecureSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function ensureSecureSecret(): Promise<string> {
  const envSecret = process.env['BETTER_AUTH_SECRET'];
  const defaultSecrets = [
    'firefly-dev-secret-key-change-in-production-32chars',
    'miniclaw-dev-secret-key-change-in-production-32chars',
    'your-secret-key-at-least-32-characters-long',
  ];

  if (envSecret && !defaultSecrets.includes(envSecret)) {
    return envSecret;
  }

  const newSecret = generateSecureSecret();
  const envPath = join(process.cwd(), '.env');

  try {
    await access(envPath);
    const content = await readFile(envPath, 'utf-8');
    
    const secretRegex = /^(BETTER_AUTH_SECRET=).*/m;
    
    if (secretRegex.test(content)) {
      const updatedContent = content.replace(secretRegex, `$1${newSecret}`);
      await writeFile(envPath, updatedContent, 'utf-8');
    } else {
      const updatedContent = content + `\nBETTER_AUTH_SECRET=${newSecret}\n`;
      await writeFile(envPath, updatedContent, 'utf-8');
    }
    
    logger.info('🔐 Generated new BETTER_AUTH_SECRET and saved to .env');
  } catch {
    logger.info('🔐 Generated new BETTER_AUTH_SECRET (no .env file to update)');
  }

  process.env['BETTER_AUTH_SECRET'] = newSecret;
  return newSecret;
}

const betterAuthSecret = await ensureSecureSecret();

const configSchema = z.object({
  port: z.number().default(3040),
  host: z.string().default('0.0.0.0'),
  databasePath: z.string().default('./data/firefly.db'),
  jwtSecret: z.string().default('firefly-secret-change-in-production'),
  jwtExpiresIn: z.string().default('7d'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  betterAuthSecret: z.string(),
  betterAuthUrl: z.string().optional(),
});

type Config = z.infer<typeof configSchema>;

export const config: Config = configSchema.parse({
  port: process.env['PORT'] ? parseInt(process.env['PORT'], 10) : undefined,
  host: process.env['HOST'],
  databasePath: process.env['DATABASE_PATH'],
  jwtSecret: process.env['JWT_SECRET'],
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'],
  nodeEnv: process.env['NODE_ENV'],
  betterAuthSecret,
  betterAuthUrl: process.env['BETTER_AUTH_URL'],
});

export default config;
