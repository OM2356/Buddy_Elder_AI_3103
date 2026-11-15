import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations.ts';
import { seedDatabase } from './seed.ts';

let sharedDb: Database.Database | null = null;

export function createDatabase(dbPath: string): Database.Database {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  seedDatabase(db);
  return db;
}

export function getDb(dbPath?: string): Database.Database {
  if (!sharedDb) {
    sharedDb = createDatabase(dbPath || process.env.DATABASE_PATH || './data/buddy_elder.db');
  }
  return sharedDb;
}

export function closeDb() {
  if (sharedDb) {
    sharedDb.close();
    sharedDb = null;
  }
}
