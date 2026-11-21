import { db } from '../db/database.js';
import { rangeCutoff } from '../utils/time.js';

export function calculateStats(checks) {
  const total = checks.length;
  const up = checks.filter((check) => check.status === 'up').length;
  const latencies = checks
    .filter((check) => check.status === 'up')
    .map((check) => check.latency_ms)
    .filter((latency) => typeof latency === 'number');

  return {
    uptime_percentage: total === 0 ? 0 : Math.round((up / total) * 10000) / 100,
    average_latency_ms: latencies.length === 0
      ? null
      : Math.round((latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length) * 100) / 100,
    min_latency_ms: latencies.length === 0 ? null : Math.min(...latencies),
    max_latency_ms: latencies.length === 0 ? null : Math.max(...latencies),
    total_checks: total
  };
}

export function getMonitorChecks(monitorId, range) {
  return db.prepare(`
    SELECT id, monitor_id, checked_at, status, latency_ms, status_code, error
    FROM checks
    WHERE monitor_id = ? AND checked_at >= ?
    ORDER BY checked_at DESC
  `).all(monitorId, rangeCutoff(range));
}

export function getMonitorStats(monitorId, range) {
  return calculateStats(getMonitorChecks(monitorId, range));
}

export function aggregateChartData(checks, range) {
  if (range === '1h') {
    return {
      aggregated: false,
      bucket_ms: null,
      points: checks
        .slice()
        .sort((left, right) => new Date(left.checked_at) - new Date(right.checked_at))
        .map((check) => ({
          timestamp: new Date(check.checked_at).toISOString(),
          status: check.status,
          latency_ms: check.status === 'up' ? check.latency_ms : null
        }))
    };
  }

  const bucketMs = {
    '24h': 5 * 60 * 1000,
    '7d': 60 * 60 * 1000,
    '30d': 6 * 60 * 60 * 1000
  }[range];
  const buckets = new Map();

  for (const check of checks) {
    const timestamp = new Date(check.checked_at).getTime();
    const bucketStart = Math.floor(timestamp / bucketMs) * bucketMs;
    if (!buckets.has(bucketStart)) {
      buckets.set(bucketStart, { latencies: [], failed_checks: 0 });
    }
    const bucket = buckets.get(bucketStart);
    if (check.status === 'down') {
      bucket.failed_checks += 1;
    } else if (typeof check.latency_ms === 'number') {
      bucket.latencies.push(check.latency_ms);
    }
  }

  const points = [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([timestamp, bucket]) => {
      const latencies = bucket.latencies;
      return {
        timestamp: new Date(timestamp).toISOString(),
        average_latency_ms: latencies.length === 0
          ? null
          : Math.round((latencies.reduce((sum, value) => sum + value, 0) / latencies.length) * 100) / 100,
        min_latency_ms: latencies.length === 0 ? null : Math.min(...latencies),
        max_latency_ms: latencies.length === 0 ? null : Math.max(...latencies),
        failed_checks: bucket.failed_checks
      };
    });

  return { aggregated: true, bucket_ms: bucketMs, points };
}

export function getMonitorChartData(monitorId, range) {
  return aggregateChartData(getMonitorChecks(monitorId, range), range);
}

export function getMonitorDashboardStats(monitorId) {
  const cutoff = rangeCutoff('24h');
  const checks = db.prepare(`
    SELECT id, monitor_id, checked_at, status, latency_ms, status_code, error
    FROM checks
    WHERE monitor_id = ? AND checked_at >= ?
    ORDER BY checked_at ASC
  `).all(monitorId, cutoff);
  const latestSuccessful = [...checks].reverse().find((check) =>
    check.status === 'up' && typeof check.latency_ms === 'number'
  );
  const base = calculateStats(checks);
  return {
    uptime_percentage: base.uptime_percentage,
    last_latency_ms: latestSuccessful?.latency_ms ?? null,
    sparkline: checks
      .filter((check) => check.status === 'up')
      .map((check) => check.latency_ms)
      .filter((latency) => typeof latency === 'number')
      .slice(-12)
  };
}
