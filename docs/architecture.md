# NetWatch Architecture

```text
Browser
  |  HTML, CSS, JavaScript
  |  REST JSON + Server-Sent Events
  v
Express application
  |  routes
  |  validation and authentication
  v
Services
  |  checkers, scheduler, status logic, statistics
  v
SQLite
  monitors, checks, incidents, users
```

The Express application provides JSON APIs and serves static files from `public/`.
The scheduler starts timers for enabled monitors and calls the same monitor service
used by the "Check now" endpoint. Check results are stored in SQLite, status thresholds
open or close incidents, and SSE publishes live check/status events.
