import { db } from '../db/database.js';
import { checkPing } from './checkers/ping.js';
import { checkTcp } from './checkers/tcp.js';
import { checkHttp } from './checkers/http.js';
import { publishEvent } from './events.js';
import {
  formatDownWebhookMessage,
  formatDowntime,
  formatRecoveryWebhookMessage,
  sendStatusWebhook,
  shouldSendStatusWebhook
} from './webhook.js';

const runningChecks = new Set();

export async function runMonitorCheck(monitorId) {
  if (runningChecks.has(monitorId)) {
    throw new Error('A check is already running for this monitor');
  }
  runningChecks.add(monitorId);
  try {
    const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(monitorId);
    if (!monitor) {
      throw new Error('Monitor not found');
    }
    if (!monitor.enabled) {
      throw new Error('Cannot check a paused monitor');
    }

    let result;
    try {
      if (monitor.type === 'ping') result = await checkPing(monitor);
      else if (monitor.type === 'tcp') result = await checkTcp(monitor);
      else result = await checkHttp(monitor);
    } catch (error) {
      result = {
        status: 'down',
        latency_ms: null,
        status_code: null,
        error: error.message || 'Unexpected check error'
      };
    }

    const timestamp = new Date().toISOString();
    db.prepare(`
      INSERT INTO checks (monitor_id, checked_at, status, latency_ms, status_code, error)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      monitor.id,
      timestamp,
      result.status,
      result.latency_ms,
      result.status_code,
      result.error
    );

    const previousStatus = monitor.enabled ? monitor.current_status : 'paused';
    const openIncidentBeforeCheck = db.prepare(`
      SELECT started_at, reason
      FROM incidents
      WHERE monitor_id = ? AND ended_at IS NULL
    `).get(monitor.id);
    const statusChange = applyStatusLogic(monitor, result, timestamp);
    const checkRecord = db.prepare(
      'SELECT * FROM checks WHERE monitor_id = ? ORDER BY id DESC LIMIT 1'
    ).get(monitor.id);
    publishEvent('check', { monitor_id: monitor.id, check: checkRecord });
    if (
      statusChange.changed
      && previousStatus !== statusChange.currentStatus
      && shouldSendStatusWebhook(previousStatus, statusChange.currentStatus)
    ) {
      publishEvent('status-change', {
        monitor_id: monitor.id,
        from: previousStatus,
        to: statusChange.currentStatus
      });
      let message;
      if (statusChange.currentStatus === 'down') {
        const openIncident = db.prepare(`
          SELECT reason
          FROM incidents
          WHERE monitor_id = ? AND ended_at IS NULL
        `).get(monitor.id);
        message = formatDownWebhookMessage(monitor, openIncident?.reason || result.error, timestamp);
      } else {
        const downtime = formatDowntime(openIncidentBeforeCheck?.started_at, timestamp);
        message = formatRecoveryWebhookMessage(monitor, downtime, timestamp);
      }
      void sendStatusWebhook(message);
    }
    return db.prepare('SELECT * FROM checks WHERE monitor_id = ? ORDER BY id DESC LIMIT 1').get(monitor.id);
  } finally {
    runningChecks.delete(monitorId);
  }
}

export function applyStatusLogic(monitor, result, timestamp) {
  let statusChanged = false;
  let currentStatus = monitor.enabled ? monitor.current_status : 'paused';
  if (result.status === 'down') {
    const consecutiveFailures = monitor.consecutive_failures + 1;
    let nextStatus = monitor.current_status;

    // A monitor becomes DOWN only after its configured consecutive-failure threshold.
    if (consecutiveFailures >= monitor.failure_threshold) {
      nextStatus = 'down';
      const openIncident = db.prepare(
        'SELECT id FROM incidents WHERE monitor_id = ? AND ended_at IS NULL'
      ).get(monitor.id);
      if (!openIncident) {
        db.prepare(`
          INSERT INTO incidents (monitor_id, started_at, ended_at, reason)
          VALUES (?, ?, NULL, ?)
        `).run(monitor.id, timestamp, result.error || 'Monitor became unreachable');
      }
    }

    db.prepare(`
      UPDATE monitors
      SET current_status = ?, consecutive_failures = ?, updated_at = ?
      WHERE id = ?
    `).run(nextStatus, consecutiveFailures, timestamp, monitor.id);
    statusChanged = nextStatus !== monitor.current_status;
    currentStatus = nextStatus;
  } else {
    // One success recovers a monitor and closes all open incident data.
    db.prepare(
      'UPDATE incidents SET ended_at = ? WHERE monitor_id = ? AND ended_at IS NULL'
    ).run(timestamp, monitor.id);

    db.prepare(`
      UPDATE monitors
      SET current_status = 'up', consecutive_failures = 0, updated_at = ?
      WHERE id = ?
    `).run(timestamp, monitor.id);
    statusChanged = monitor.current_status !== 'up';
    currentStatus = 'up';
  }
  return { changed: statusChanged, currentStatus };
}
