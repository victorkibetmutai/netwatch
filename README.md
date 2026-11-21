# NetWatch

NetWatch is a network monitoring dashboard for devices, servers, and websites. It records PING, TCP port, and HTTP/HTTPS checks, tracks uptime and latency, opens incidents after repeated failures, and closes them after recovery.

## Features

- PING, TCP port, and HTTP/HTTPS monitors
- Configurable intervals, timeouts, failure thresholds, and HTTP status
- Consecutive-failure status and incident tracking
- 24-hour uptime and latency sparklines
- Searchable and filterable dashboard
- Add, edit, pause, resume, check, and delete controls
- Monitor detail charts and history tables
- Server-Sent Events live updates
- JWT authentication and bcrypt passwords
- Optional Discord/Slack-compatible webhook alerts
- Docker and GitHub Actions support

## Architecture

```text
Browser --> Express routes --> Services/checkers --> SQLite
                    |                                   |
                    +---------- SSE events ------------+
```

See [docs/architecture.md](docs/architecture.md) for the component diagram.

## Tech Stack

- Node.js 20+
- Express
- SQLite with `better-sqlite3`
- Plain HTML, CSS, and JavaScript
- Chart.js
- Vitest and Supertest
- Docker and docker-compose
- GitHub Actions

## Run Locally on Windows

```powershell
cd C:\Users\VICTOR\projects\netwatch
Copy-Item .env.example .env
npm install
npm run seed
npm run dev
```

Open `http://localhost:3000`. Visit `/login.html` to register the first administrator account.

## Run with Docker

Docker Desktop must be installed and running.

```powershell
docker compose up --build
```

Open `http://localhost:3000`. Stop with:

```powershell
docker compose down
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port | `3000` |
| `DB_PATH` | SQLite database path | `./data/netwatch.db` |
| `JWT_SECRET` | Secret used to sign JWT tokens | Development fallback |
| `CHECK_RETENTION_DAYS` | Delete checks older than this | `30` |
| `WEBHOOK_URL` | Optional Discord or Slack webhook URL | Empty |

Never commit `.env`. Always replace the JWT secret in production.

## Status and Incident Logic

- A failed check increments `consecutive_failures`.
- The monitor becomes `down` only after reaching `failure_threshold`.
- The first threshold failure opens one incident.
- One successful check sets the monitor back to `up`.
- Recovery closes the open incident and adds its end time.
- Disabled monitors show `paused`.
- Monitors never checked show `unknown`.

## API Reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health and process uptime |
| GET | `/api/monitors` | List monitors |
| POST | `/api/monitors` | Create monitor (auth required) |
| GET | `/api/monitors/:id` | Get monitor |
| PUT | `/api/monitors/:id` | Update monitor (auth required) |
| DELETE | `/api/monitors/:id` | Delete monitor (auth required) |
| POST | `/api/monitors/:id/check` | Run immediate check (auth required) |
| GET | `/api/monitors/:id/checks?range=1h\|24h\|7d\|30d` | Check history |
| GET | `/api/monitors/:id/stats?range=1h\|24h\|7d\|30d` | Monitor statistics |
| GET | `/api/incidents?monitor_id=&status=open\|closed` | Incident history |
| GET | `/api/summary` | Dashboard totals |
| GET | `/api/events` | Server-Sent Events |
| POST | `/api/auth/register` | Register the first administrator |
| POST | `/api/auth/login` | Obtain a JWT |

Send authenticated write requests with:

```text
Authorization: Bearer <token>
```

## Tests

```powershell
npm test
```

The suite covers hostname and URL validation, PING parsing, status/incident logic, uptime calculations, and CRUD/API behavior.

## Security

Monitoring tools can reach internal networks. Do not expose NetWatch publicly without authentication and network controls.

- Hostname and URL validation rejects shell characters.
- PING uses `execFile` with an argument array, never shell command strings.
- SQL uses parameterized queries.
- JSON bodies are size-limited.
- Helmet and `/api` rate limiting are enabled.
- Passwords use bcrypt.
- Write APIs require JWT authentication.

## Design Decisions and Trade-offs

SQLite keeps setup simple and fits small/medium deployments, but it is not a distributed database. Per-monitor timers avoid a heavy job system but remain in local memory and reset on restart. The failure threshold reduces false alarms while adding time before DOWN status is recorded. Read APIs are public for dashboard convenience; write APIs require authentication.

## Roadmap

- Alert routing through webhooks
- DNS monitor type
- SSL certificate expiry monitor
- Public status page
