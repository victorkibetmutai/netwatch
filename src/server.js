import app from './app.js';
import { config } from './config.js';
import { startScheduler } from './services/scheduler.js';

app.listen(config.port, () => {
  console.log(`NetWatch listening on http://localhost:${config.port}`);
  if (process.env.NODE_ENV !== 'test') {
    startScheduler();
  }
});
