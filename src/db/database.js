import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';

const dbDirectory = path.dirname(config.dbPath);
if (dbDirectory !== '.') {
  fs.mkdirSync(dbDirectory, { recursive: true });
}

export const db = new Database(config.dbPath);
db.pragma('foreign_keys = ON');

export function initializeDatabase(database = db) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('ping', 'tcp', 'http')),
      target TEXT NOT NULL,
      port INTEGER,
      interval_seconds INTEGER NOT NULL DEFAULT 60,
      timeout_ms INTEGER NOT NULL DEFAULT 5000,
      expected_status INTEGER NOT NULL DEFAULT 200,
      failure_threshold INTEGER NOT NULL DEFAULT 3,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      current_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (current_status IN ('unknown', 'up', 'down', 'paused')),
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      checked_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('up', 'down')),
      latency_ms REAL,
      status_code INTEGER,
      error TEXT,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_checks_monitor_checked
      ON checks (monitor_id, checked_at);

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      reason TEXT NOT NULL,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

initializeDatabase();
