import { Router } from 'express';
import { db } from '../db/database.js';
import {
  getMonitorChartData,
  getMonitorChecks,
  getMonitorStats
} from '../services/statsService.js';
import { validateRange } from '../utils/time.js';

const router = Router();

router.get('/:id/checks', (request, response) => {
  const monitor = db.prepare('SELECT id FROM monitors WHERE id = ?').get(request.params.id);
  if (!monitor) return response.status(404).json({ error: 'Monitor not found' });

  const range = request.query.range || '24h';
  if (!validateRange(range)) {
    return response.status(400).json({ error: 'range must be 1h, 24h, 7d, or 30d' });
  }
  response.json(getMonitorChecks(monitor.id, range));
});

router.get('/:id/chart', (request, response) => {
  const monitor = db.prepare('SELECT id FROM monitors WHERE id = ?').get(request.params.id);
  if (!monitor) return response.status(404).json({ error: 'Monitor not found' });

  const range = request.query.range || '24h';
  if (!validateRange(range)) {
    return response.status(400).json({ error: 'range must be 1h, 24h, 7d, or 30d' });
  }
  response.json(getMonitorChartData(monitor.id, range));
});

router.get('/:id/stats', (request, response) => {
  const monitor = db.prepare('SELECT id FROM monitors WHERE id = ?').get(request.params.id);
  if (!monitor) return response.status(404).json({ error: 'Monitor not found' });

  const range = request.query.range || '24h';
  if (!validateRange(range)) {
    return response.status(400).json({ error: 'range must be 1h, 24h, 7d, or 30d' });
  }
  response.json(getMonitorStats(monitor.id, range));
});

export default router;
