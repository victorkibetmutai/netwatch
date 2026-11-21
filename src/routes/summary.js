import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

router.get('/', (_request, response) => {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS monitors,
      SUM(CASE WHEN enabled = 1 AND current_status = 'up' THEN 1 ELSE 0 END) AS up,
      SUM(CASE WHEN enabled = 1 AND current_status = 'down' THEN 1 ELSE 0 END) AS down,
      SUM(CASE WHEN enabled = 0 OR current_status = 'paused' THEN 1 ELSE 0 END) AS paused
    FROM monitors
  `).get();
  const latency = db.prepare(`
    SELECT AVG(latency_ms) AS average_latency
    FROM checks
    WHERE checked_at >= ?
      AND status = 'up'
      AND latency_ms IS NOT NULL
  `).get(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const incidents = db.prepare(
    'SELECT COUNT(*) AS open_incidents FROM incidents WHERE ended_at IS NULL'
  ).get();

  response.json({
    monitors: totals.monitors,
    up: totals.up || 0,
    down: totals.down || 0,
    paused: totals.paused || 0,
    average_latency: latency.average_latency === null
      ? null
      : Math.round(latency.average_latency * 100) / 100,
    open_incidents: incidents.open_incidents
  });
});

export default router;
