import { db } from '../db/database.js';
import { config } from '../config.js';
import { runMonitorCheck } from './monitorService.js';

const timers = new Map();
const running = new Set();

export function startScheduler() {
  stopScheduler();
  const monitors = db.prepare('SELECT * FROM monitors WHERE enabled = 1').all();
  for (const monitor of monitors) {
    addMonitorTimer(monitor);
  }
  runCleanup();
  scheduleCleanup();
}

export function stopScheduler() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = null;
}

export function addMonitorTimer(monitor) {
  removeMonitorTimer(monitor.id);
  if (!monitor.enabled) return;

  const scheduleNext = () => {
    const baseDelay = monitor.interval_seconds * 1000;
    const jitter = Math.floor(Math.random() * 1001);
    const timer = setTimeout(async () => {
      await runScheduledCheck(monitor.id);
      scheduleNext();
    }, baseDelay + jitter);
    timers.set(monitor.id, timer);
  };

  scheduleNext();
}

export function removeMonitorTimer(monitorId) {
  const timer = timers.get(monitorId);
  if (timer) clearTimeout(timer);
  timers.delete(monitorId);
}

async function runScheduledCheck(monitorId) {
  if (running.has(monitorId)) return;
  running.add(monitorId);
  try {
    await runMonitorCheck(monitorId);
  } catch (error) {
    console.error(`Scheduled check for monitor ${monitorId} failed:`, error.message);
  } finally {
    running.delete(monitorId);
  }
}

export function runCleanup() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.checkRetentionDays);
  db.prepare('DELETE FROM checks WHERE checked_at < ?').run(cutoff.toISOString());
}

let cleanupTimer = null;

function scheduleCleanup() {
  cleanupTimer = setInterval(runCleanup, 24 * 60 * 60 * 1000);
}
