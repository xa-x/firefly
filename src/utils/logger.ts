import chalk from 'chalk';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = 
  (process.env['LOG_LEVEL'] as LogLevel) || 
  (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (shouldLog('debug')) {
      console.log(chalk.gray(`[${formatTimestamp()}]`), chalk.blue('DEBUG'), message, ...args);
    }
  },

  info(message: string, ...args: unknown[]) {
    if (shouldLog('info')) {
      console.log(chalk.gray(`[${formatTimestamp()}]`), chalk.green('INFO'), message, ...args);
    }
  },

  warn(message: string, ...args: unknown[]) {
    if (shouldLog('warn')) {
      console.log(chalk.gray(`[${formatTimestamp()}]`), chalk.yellow('WARN'), message, ...args);
    }
  },

  error(message: string, ...args: unknown[]) {
    if (shouldLog('error')) {
      console.log(chalk.gray(`[${formatTimestamp()}]`), chalk.red('ERROR'), message, ...args);
    }
  },
};

export default logger;
