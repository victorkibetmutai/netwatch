import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import monitorsRouter from './routes/monitors.js';
import checksRouter from './routes/checks.js';
import incidentsRouter from './routes/incidents.js';
import summaryRouter from './routes/summary.js';
import eventsRouter from './routes/events.js';
import authRouter from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();
const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', uptime: process.uptime() });
});
app.use('/api/auth', authRouter);
app.use('/api/monitors', monitorsRouter);
app.use('/api/monitors', checksRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/events', eventsRouter);
app.use('/vendor', express.static(path.join(currentDirectory, '..', 'node_modules', 'chart.js', 'dist')));
app.use('/vendor/chartjs-adapter-date-fns', express.static(
  path.join(currentDirectory, '..', 'node_modules', 'chartjs-adapter-date-fns', 'dist')
));
app.use(express.static(path.join(currentDirectory, '..', 'public')));
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
