import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

router.get('/', (request, response) => {
  const monitorId = request.query.monitor_id;
  const status = request.query.status;
  const conditions = [];
  const values = [];

  if (monitorId !== undefined) {
    if (!Number.isInteger(Number(monitorId))) {
      return response.status(400).json({ error: 'monitor_id must be an integer' });
    }
    conditions.push('i.monitor_id = ?');
    values.push(Number(monitorId));
  }
  if (status !== undefined) {
    if (!['open', 'closed'].includes(status)) {
      return response.status(400).json({ error: 'status must be open or closed' });
    }
    conditions.push(status === 'open' ? 'i.ended_at IS NULL' : 'i.ended_at IS NOT NULL');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const incidents = db.prepare(`
    SELECT i.id, i.monitor_id, i.started_at, i.ended_at, i.reason,
           m.name AS monitor_name
    FROM incidents i
    JOIN monitors m ON m.id = i.monitor_id
    ${where}
    ORDER BY i.started_at DESC
  `).all(...values);
  response.json(incidents);
});

export default router;
