import { Router } from 'express';
import { db } from '../db/database.js';
import {
  partialValidationMiddleware,
  validateMonitorInput,
  validationMiddleware
} from '../middleware/validation.js';
import { runMonitorCheck } from '../services/monitorService.js';
import { addMonitorTimer, removeMonitorTimer } from '../services/scheduler.js';
import { getMonitorDashboardStats } from '../services/statsService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function now() {
  return new Date().toISOString();
}

function mapMonitor(monitor) {
  return {
    ...monitor,
    enabled: Boolean(monitor.enabled)
  };
}

router.get('/', (_request, response) => {
  const monitors = db.prepare('SELECT * FROM monitors ORDER BY id DESC').all().map((monitor) => ({
    ...mapMonitor(monitor),
    ...getMonitorDashboardStats(monitor.id)
  }));
  response.json(monitors);
});

router.post('/', requireAuth, validationMiddleware, (request, response) => {
  const input = request.body;
  const timestamp = now();
  const result = db.prepare(`
    INSERT INTO monitors (
      name, type, target, port, interval_seconds, timeout_ms,
      expected_status, failure_threshold, enabled, current_status,
      consecutive_failures, created_at, updated_at
    ) VALUES (
      @name, @type, @target, @port, @interval_seconds, @timeout_ms,
      @expected_status, @failure_threshold, @enabled, @current_status,
      0, @created_at, @updated_at
    )
  `).run({
    name: input.name.trim(),
    type: input.type,
    target: input.target,
    port: input.port ?? null,
    interval_seconds: input.interval_seconds ?? 60,
    timeout_ms: input.timeout_ms ?? 5000,
    expected_status: input.expected_status ?? 200,
    failure_threshold: input.failure_threshold ?? 3,
    enabled: input.enabled === undefined || input.enabled ? 1 : 0,
    current_status: input.enabled === false ? 'paused' : 'unknown',
    created_at: timestamp,
    updated_at: timestamp
  });
  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(result.lastInsertRowid);
  if (monitor.enabled) {
    addMonitorTimer(mapMonitor(monitor));
  }
  response.status(201).json(mapMonitor(monitor));
});

router.get('/:id', (request, response) => {
  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(request.params.id);
  if (!monitor) {
    return response.status(404).json({ error: 'Monitor not found' });
  }
  response.json(mapMonitor(monitor));
});

router.put('/:id', requireAuth, partialValidationMiddleware, (request, response) => {
  const existing = db.prepare('SELECT * FROM monitors WHERE id = ?').get(request.params.id);
  if (!existing) {
    return response.status(404).json({ error: 'Monitor not found' });
  }

  const input = { ...request.body };
  const merged = {
    name: input.name ?? existing.name,
    type: input.type ?? existing.type,
    target: input.target ?? existing.target,
    port: input.port ?? existing.port,
    interval_seconds: input.interval_seconds ?? existing.interval_seconds,
    timeout_ms: input.timeout_ms ?? existing.timeout_ms,
    expected_status: input.expected_status ?? existing.expected_status,
    failure_threshold: input.failure_threshold ?? existing.failure_threshold,
    enabled: input.enabled === undefined ? Boolean(existing.enabled) : input.enabled
  };
  if (merged.type !== 'tcp') {
    delete merged.port;
  }
  if (merged.type !== 'http') {
    delete merged.expected_status;
  }
  const errors = validateMonitorInput(merged);
  if (errors.length > 0) {
    return response.status(400).json({ error: errors.join('; ') });
  }

  const fields = [
    'name', 'type', 'target', 'port', 'interval_seconds', 'timeout_ms',
    'expected_status', 'failure_threshold', 'enabled'
  ];
  const updates = {};
  for (const field of fields) {
    if (input[field] !== undefined) {
      updates[field] = field === 'enabled' ? (input[field] ? 1 : 0) : input[field];
    }
  }
  if (input.type && input.type !== existing.type) {
    updates.port = input.type === 'tcp' ? (input.port ?? null) : null;
    updates.expected_status = input.type === 'http' ? (input.expected_status ?? 200) : 200;
  }
  if (updates.enabled !== undefined) {
    updates.current_status = updates.enabled ? 'unknown' : 'paused';
  }
  updates.updated_at = now();

  const assignments = Object.keys(updates).map((field) => `${field} = @${field}`).join(', ');
  db.prepare(`UPDATE monitors SET ${assignments} WHERE id = @id`).run({ ...updates, id: request.params.id });
  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(request.params.id);
  if (monitor.enabled) {
    addMonitorTimer(mapMonitor(monitor));
  } else {
    removeMonitorTimer(monitor.id);
  }
  response.json(mapMonitor(monitor));
});

router.delete('/:id', requireAuth, (request, response) => {
  const result = db.prepare('DELETE FROM monitors WHERE id = ?').run(request.params.id);
  if (result.changes === 0) {
    return response.status(404).json({ error: 'Monitor not found' });
  }
  removeMonitorTimer(Number(request.params.id));
  response.status(204).send();
});

router.post('/:id/check', requireAuth, async (request, response, next) => {
  try {
    const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(request.params.id);
    if (!monitor) {
      return response.status(404).json({ error: 'Monitor not found' });
    }
    if (!monitor.enabled) {
      return response.status(400).json({ error: 'Cannot check a paused monitor' });
    }
    const check = await runMonitorCheck(monitor.id);
    response.json(check);
  } catch (error) {
    next(error);
  }
});

export default router;
