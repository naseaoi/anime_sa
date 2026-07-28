import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { applySqliteMaintenance, inspectSqliteStorage } from '../server/core/sqliteMaintenance.js';

const args = process.argv.slice(2);
let apply = false;
let databaseArgument = '';
let requestedBackupPath = '';

for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === '--apply') {
    apply = true;
    continue;
  }
  if (argument === '--backup') {
    const backupArgument = String(args[index + 1] || '');
    if (!backupArgument || backupArgument.startsWith('--')) {
      console.error('Missing backup path');
      process.exit(2);
    }
    requestedBackupPath = backupArgument;
    index += 1;
    continue;
  }
  if (argument.startsWith('--') || databaseArgument) {
    console.error(`Unknown argument: ${argument}`);
    process.exit(2);
  }
  databaseArgument = argument;
}

const validatePathArgument = (value, label) => {
  if (value.includes('\0') || value.length > 4096) throw new Error(`Invalid ${label} path`);
};

validatePathArgument(databaseArgument, 'database');
validatePathArgument(requestedBackupPath, 'backup');
const databasePath = path.resolve(databaseArgument || path.join('data', 'local.db'));

if (!fs.existsSync(databasePath)) {
  console.error(`SQLite database not found: ${databasePath}`);
  process.exit(1);
}

const database = new Database(databasePath, { readonly: !apply, fileMustExist: true });

try {
  const integrity = database.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', databasePath, report: inspectSqliteStorage(database) }, null, 2));
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.resolve(requestedBackupPath || `${databasePath}.backup-${timestamp}`);
    if (backupPath === databasePath) throw new Error('Backup path must differ from database path');
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    await database.backup(backupPath);

    const backup = new Database(backupPath, { readonly: true, fileMustExist: true });
    try {
      const backupIntegrity = backup.pragma('integrity_check', { simple: true });
      if (backupIntegrity !== 'ok') throw new Error(`Backup integrity check failed: ${backupIntegrity}`);
    } finally {
      backup.close();
    }

    const result = applySqliteMaintenance(database);
    console.log(JSON.stringify({ mode: 'apply', databasePath, backupPath, ...result }, null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  database.close();
}
