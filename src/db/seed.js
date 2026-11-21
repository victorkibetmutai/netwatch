import { db, initializeDatabase } from './database.js';

initializeDatabase();

const monitors = [
  {
    name: 'Example website',
    type: 'http',
    target: 'https://example.com',
    port: null
  },
  {
    name: 'Cloudflare DNS',
    type: 'ping',
    target: '1.1.1.1',
    port: null
  },
  {
    name: 'Google DNS',
    type: 'tcp',
    target: '8.8.8.8',
    port: 53
  },
  {
    name: 'Deliberately failing demo',
    type: 'tcp',
    target: '10.255.255.1',
    port: 81
  }
];

const insert = db.prepare(`
  INSERT INTO monitors (
    name, type, target, port, interval_seconds, timeout_ms,
    expected_status, failure_threshold, enabled, current_status,
    consecutive_failures, created_at, updated_at
  ) VALUES (?, ?, ?, ?, 60, 5000, 200, 3, 1, 'unknown', 0, ?, ?)
`);

const findExisting = db.prepare(`
  SELECT id
  FROM monitors
  WHERE name = ?
    AND type = ?
    AND target = ?
    AND port IS ?
`);

const timestamp = new Date().toISOString();
const seed = db.transaction(() => {
  const added = [];
  const skipped = [];

  for (const monitor of monitors) {
    const existing = findExisting.get(
      monitor.name,
      monitor.type,
      monitor.target,
      monitor.port
    );

    if (existing) {
      skipped.push(monitor.name);
      continue;
    }

    insert.run(
      monitor.name,
      monitor.type,
      monitor.target,
      monitor.port,
      timestamp,
      timestamp
    );
    added.push(monitor.name);
  }

  return { added, skipped };
});

const { added, skipped } = seed();

for (const name of added) {
  console.log(`Added: ${name}`);
}
for (const name of skipped) {
  console.log(`Skipped: ${name}`);
}
