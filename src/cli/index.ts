#!/usr/bin/env bun
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, isAbsolute, resolve, dirname } from 'path';
import { Database } from 'bun:sqlite';

const rawDbPath = process.env['DATABASE_PATH'] || './data/firefly.db';
const DB_PATH = isAbsolute(rawDbPath) ? rawDbPath : resolve(process.cwd(), rawDbPath);

function openDatabase(): Database {
  mkdir(dirname(DB_PATH), { recursive: true }).catch(() => {});
  const db = new Database(DB_PATH);
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  return db;
}

const program = new Command();

program
  .name('firefly')
  .description('Lightweight backend-as-a-service CLI')
  .version('0.1.0');

// Start server command
program
  .command('start')
  .description('Start the Firefly server')
  .option('-p, --port <number>', 'Port to listen on')
  .option('--host <string>', 'Host to bind to')
  .action(async (options) => {
    // Use env vars or options (config will apply defaults)
    const port = options.port || process.env['PORT'];
    const host = options.host || process.env['HOST'];
    
    if (port) process.env['PORT'] = port;
    if (host) process.env['HOST'] = host;
    
    const { default: startServer } = await import('../index');
    startServer();
  });

// Migrate commands
const migrateCmd = program
  .command('migrate')
  .description('Migration management');

migrateCmd
  .command('create <name>')
  .description('Create a new migration file')
  .action(async (name) => {
    const spinner = ora('Creating migration...').start();
    
    try {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filename = `${timestamp}_${safeName}.sql`;
      const migrationsDir = join(process.cwd(), 'migrations');
      
      await mkdir(migrationsDir, { recursive: true });
      
      const content = `-- Migration: ${name}
-- Created at: ${new Date().toISOString()}

-- UP
-- Add your UP migration here

-- DOWN
-- Add your DOWN migration here
`;
      
      await writeFile(join(migrationsDir, filename), content);
      
      spinner.succeed(chalk.green(`Migration created: migrations/${filename}`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to create migration'));
      console.error(error);
      process.exit(1);
    }
  });

migrateCmd
  .command('up')
  .description('Run pending migrations')
  .action(async () => {
    const spinner = ora('Running migrations...').start();
    
    try {
      const db = openDatabase();
      const migrationsDir = join(process.cwd(), 'migrations');
      
      let files: string[] = [];
      try {
        const entries = await readdir(migrationsDir);
        files = entries.filter(f => f.endsWith('.sql')).sort();
      } catch {
        spinner.info('No migrations directory found');
        return;
      }

      let appliedCount = 0;
      for (const file of files) {
        const existing = db.query<{ count: number }, [string]>(
          'SELECT COUNT(*) as count FROM _migrations WHERE name = ?'
        ).get(file);
        if (existing && existing.count > 0) continue;

        const content = await readFile(join(migrationsDir, file), 'utf-8');
        const upMatch = content.match(/--\s*UP\s*\n([\s\S]*?)(?=--\s*DOWN|$)/i);
        const upSql = upMatch?.[1]?.trim() || '';

        if (upSql) {
          const statements = upSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
          for (const stmt of statements) {
            db.run(stmt);
          }
          db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
          appliedCount++;
          console.log(chalk.gray(`  ✓ ${file}`));
        }
      }

      db.close();
      
      if (appliedCount > 0) {
        spinner.succeed(chalk.green(`Applied ${appliedCount} migration(s)`));
      } else {
        spinner.info(chalk.yellow('No pending migrations'));
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to run migrations'));
      console.error(error);
      process.exit(1);
    }
  });

migrateCmd
  .command('down')
  .description('Rollback last migration')
  .action(async () => {
    const spinner = ora('Rolling back migration...').start();
    
    try {
      const db = openDatabase();
      
      const lastMigration = db.query<{ name: string }, []>(
        'SELECT name FROM _migrations ORDER BY applied_at DESC LIMIT 1'
      ).get();
      
      if (!lastMigration) {
        spinner.info('No migrations to rollback');
        db.close();
        return;
      }

      const migrationsDir = join(process.cwd(), 'migrations');
      const content = await readFile(join(migrationsDir, lastMigration.name), 'utf-8');
      const downMatch = content.match(/--\s*DOWN\s*\n([\s\S]*?)$/i);
      const downSql = downMatch?.[1]?.trim() || '';

      if (downSql) {
        const statements = downSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const stmt of statements) {
          db.run(stmt);
        }
      }

      db.run('DELETE FROM _migrations WHERE name = ?', [lastMigration.name]);
      db.close();
      
      spinner.succeed(chalk.green(`Rolled back: ${lastMigration.name}`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to rollback migration'));
      console.error(error);
      process.exit(1);
    }
  });

migrateCmd
  .command('status')
  .description('Show migration status')
  .action(async () => {
    console.log(chalk.blue('\nMigration Status:\n'));
    
    try {
      const db = openDatabase();
      const migrationsDir = join(process.cwd(), 'migrations');
      
      const appliedList = db.query<{ name: string; applied_at: number }, []>(
        'SELECT name, applied_at FROM _migrations ORDER BY applied_at ASC'
      ).all();
      
      let files: string[] = [];
      try {
        const entries = await readdir(migrationsDir);
        files = entries.filter(f => f.endsWith('.sql')).sort();
      } catch {
        // No migrations dir
      }

      if (files.length === 0) {
        console.log(chalk.gray('  No migrations found'));
        db.close();
        return;
      }

      for (const file of files) {
        const isApplied = appliedList.some(a => a.name === file);
        const status = isApplied ? chalk.green('✓ applied') : chalk.yellow('○ pending');
        console.log(`  ${status}  ${file}`);
      }

      console.log(chalk.gray(`\n  Total: ${files.length} | Applied: ${appliedList.length} | Pending: ${files.length - appliedList.length}\n`));
      
      db.close();
    } catch (error) {
      console.error(chalk.red('Failed to get migration status'));
      console.error(error);
      process.exit(1);
    }
  });

// Backup commands
const backupCmd = program
  .command('backup')
  .description('Backup management');

backupCmd
  .command('create')
  .description('Create a backup')
  .option('-t, --type <type>', 'Backup type (database|full)', 'database')
  .action(async () => {
    const spinner = ora('Creating backup...').start();
    
    try {
      const { gzip } = await import('zlib');
      const { promisify } = await import('util');
      const gzipAsync = promisify(gzip);
      
      const backupsDir = join(process.cwd(), 'backups');
      await mkdir(backupsDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
      
      const dbContent = await readFile(DB_PATH);
      const compressed = await gzipAsync(dbContent);
      const filename = `${timestamp}_backup.db.gz`;
      
      await writeFile(join(backupsDir, filename), compressed);
      
      spinner.succeed(chalk.green(`Backup created: backups/${filename}`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to create backup'));
      console.error(error);
      process.exit(1);
    }
  });

backupCmd
  .command('list')
  .description('List all backups')
  .action(async () => {
    console.log(chalk.blue('\nBackups:\n'));
    
    try {
      const backupsDir = join(process.cwd(), 'backups');
      const files = await readdir(backupsDir);
      
      const backups = files
        .filter(f => f.endsWith('.gz'))
        .sort((a, b) => b.localeCompare(a));

      if (backups.length === 0) {
        console.log(chalk.gray('  No backups found'));
        return;
      }

      for (const file of backups) {
        const parts = file.replace('.db.gz', '').split('_');
        const timestamp = parts.slice(0, 2).join('_');
        console.log(`  ${chalk.gray(timestamp)}  ${file}`);
      }

      console.log(chalk.gray(`\n  Total: ${backups.length} backup(s)\n`));
    } catch {
      console.log(chalk.gray('  No backups found'));
    }
  });

backupCmd
  .command('restore <filename>')
  .description('Restore from backup')
  .action(async (filename) => {
    const spinner = ora('Restoring backup...').start();
    
    try {
      const { gunzip } = await import('zlib');
      const { promisify } = await import('util');
      const gunzipAsync = promisify(gunzip);
      
      const backupsDir = join(process.cwd(), 'backups');
      const content = await readFile(join(backupsDir, filename));
      const decompressed = await gunzipAsync(content);
      
      await writeFile(DB_PATH, decompressed);
      
      spinner.succeed(chalk.green(`Restored from: ${filename}`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to restore backup'));
      console.error(error);
      process.exit(1);
    }
  });

// Tables commands
const tablesCmd = program
  .command('tables')
  .description('Table management');

tablesCmd
  .command('list')
  .description('List all tables')
  .action(async () => {
    console.log(chalk.blue('\nTables:\n'));
    
    try {
      const db = openDatabase();
      const tables = db.query<{ name: string; schema: string }, []>(
        'SELECT name, schema FROM _tables ORDER BY created_at DESC'
      ).all();
      
      if (tables.length === 0) {
        console.log(chalk.gray('  No tables found'));
        db.close();
        return;
      }

      for (const table of tables) {
        const schema = JSON.parse(table.schema);
        console.log(`  ${chalk.green(table.name)} ${chalk.gray(`(${schema.columns.length} columns)`)}`);
      }

      console.log(chalk.gray(`\n  Total: ${tables.length} table(s)\n`));
      db.close();
    } catch (error) {
      console.error(chalk.red('Failed to list tables'));
      console.error(error);
      process.exit(1);
    }
  });

tablesCmd
  .command('drop <name>')
  .description('Drop a table')
  .action(async (name) => {
    const spinner = ora(`Dropping table '${name}'...`).start();
    
    try {
      const db = openDatabase();
      
      db.run(`DROP TABLE IF EXISTS "${name}"`);
      db.run('DELETE FROM _tables WHERE name = ?', [name]);
      
      db.close();
      spinner.succeed(chalk.green(`Table '${name}' dropped`));
    } catch (error) {
      spinner.fail(chalk.red(`Failed to drop table '${name}'`));
      console.error(error);
      process.exit(1);
    }
  });

// Users commands
const usersCmd = program
  .command('users')
  .description('User management');

usersCmd
  .command('list')
  .description('List all users')
  .action(async () => {
    console.log(chalk.blue('\nUsers:\n'));
    
    try {
      const db = openDatabase();
      const users = db.query<{ id: string; name: string; email: string; emailVerified: number; createdAt: string }, []>(
        'SELECT id, name, email, emailVerified, createdAt FROM user ORDER BY createdAt DESC'
      ).all();
      
      if (users.length === 0) {
        console.log(chalk.gray('  No users found'));
        db.close();
        return;
      }

      for (const user of users) {
        const verified = user.emailVerified ? chalk.green('✓') : chalk.yellow('○');
        console.log(`  ${verified} ${chalk.cyan(user.email)} ${chalk.gray(`(${user.name})`)}`);
      }

      console.log(chalk.gray(`\n  Total: ${users.length} user(s)\n`));
      db.close();
    } catch (error) {
      console.error(chalk.red('Failed to list users'));
      console.error(error);
      process.exit(1);
    }
  });

usersCmd
  .command('delete <email>')
  .description('Delete a user by email')
  .action(async (email) => {
    const spinner = ora(`Deleting user '${email}'...`).start();
    
    try {
      const db = openDatabase();
      
      const result = db.run('DELETE FROM user WHERE email = ?', [email]);
      
      if (result.changes > 0) {
        spinner.succeed(chalk.green(`User '${email}' deleted`));
      } else {
        spinner.fail(chalk.yellow(`User '${email}' not found`));
      }
      
      db.close();
    } catch (error) {
      spinner.fail(chalk.red(`Failed to delete user '${email}'`));
      console.error(error);
      process.exit(1);
    }
  });

program.parse();

export default program;
