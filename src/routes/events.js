import { Router } from 'express';
import { addEventClient } from '../services/events.js';

const router = Router();

router.get('/', (request, response) => {
  response.status(200);
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders();
  response.write(': connected\n\n');
  addEventClient(response);

  const keepAlive = setInterval(() => {
    if (response.writableEnded) {
      clearInterval(keepAlive);
      return;
    }
    response.write(': keep-alive\n\n');
  }, 25000);

  request.on('close', () => clearInterval(keepAlive));
});

export default router;
