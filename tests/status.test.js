import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

let db;
let applyStatusLogic;

beforeAll(async () => {
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE monitors (
      id INTEGER PRIMARY KEY,
      name TEXT,
      type TEXT,
      target TEXT,
      port INTEGER,
      interval_seconds INTEGER,
      timeout_ms INTEGER,
      expected_status INTEGER,
      failure_threshold INTEGER,
      enabled INTEGER,
      current_status TEXT,
      consecutive_failures INTEGER,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE incidents (
      id INTEGER PRIMARY KEY,
      monitor_id INTEGER,
      started_at TEXT,
      ended_at TEXT,
      reason TEXT
    );
  `);

  process.env.DB_PATH = ':memory:';
  const databaseModule = await import('../src/db/database.js');
  databaseModule.db.exec(`
    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY,
      name TEXT,
      type TEXT,
      target TEXT,
      port INTEGER,
      interval_seconds INTEGER,
      timeout_ms INTEGER,
      expected_status INTEGER,
      failure_threshold INTEGER,
      enabled INTEGER,
      current_status TEXT,
      consecutive_failures INTEGER,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY,
      monitor_id INTEGER,
      started_at TEXT,
      ended_at TEXT,
      reason TEXT
    );
  `);
  db = databaseModule.db;
  ({ applyStatusLogic } = await import('../src/services/monitorService.js'));
});

beforeEach(() => {
  db.exec('DELETE FROM incidents; DELETE FROM monitors;');
});

function insertMonitor(overrides = {}) {
  const monitor = {
    id: 1,
    name: 'Test',
    type: 'tcp',
    target: 'localhost',
    port: 80,
    interval_seconds: 60,
    timeout_ms: 5000,
    expected_status: 200,
    failure_threshold: 3,
    enabled: 1,
    current_status: 'unknown',
    consecutive_failures: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
  db.prepare(`
    INSERT INTO monitors (
      id, name, type, target, port, interval_seconds, timeout_ms,
      expected_status, failure_threshold, enabled, current_status,
      consecutive_failures, created_at, updated_at
    ) VALUES (
      @id, @name, @type, @target, @port, @interval_seconds, @timeout_ms,
      @expected_status, @failure_threshold, @enabled, @current_status,
      @consecutive_failures, @created_at, @updated_at
    )
  `).run(monitor);
  return monitor;
}

describe('status and incident logic', () => {
  it('does not open an incident below the failure threshold', () => {
    const monitor = insertMonitor({ failure_threshold: 3 });
    applyStatusLogic(monitor, { status: 'down', error: 'Timeout' }, new Date().toISOString());
    expect(db.prepare('SELECT COUNT(*) AS count FROM incidents').get().count).toBe(0);
  });

  it('opens an incident at the threshold and closes it after recovery', () => {
    const monitor = insertMonitor({
      failure_threshold: 2,
      consecutive_failures: 1
    });
    applyStatusLogic(monitor, { status: 'down', error: 'Timeout' }, new Date().toISOString());
    expect(db.prepare('SELECT COUNT(*) AS count FROM incidents').get().count).toBe(1);

    applyStatusLogic(monitor, { status: 'up', error: null }, new Date().toISOString());
    const incident = db.prepare('SELECT ended_at FROM incidents WHERE monitor_id = 1').get();
    expect(incident.ended_at).not.toBeNull();
  });
});
