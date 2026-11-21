import { describe, expect, it } from 'vitest';
import { aggregateChartData, calculateStats } from '../src/services/statsService.js';

describe('calculateStats', () => {
  it('calculates uptime and latency values', () => {
    const result = calculateStats([
      { status: 'up', latency_ms: 10 },
      { status: 'down', latency_ms: 30 },
      { status: 'up', latency_ms: 20 }
    ]);
    expect(result).toEqual({
      uptime_percentage: 66.67,
      average_latency_ms: 15,
      min_latency_ms: 10,
      max_latency_ms: 20,
      total_checks: 3
    });
  });

  it('handles an empty check history', () => {
    expect(calculateStats([]).uptime_percentage).toBe(0);
  });

  it('aggregates 24-hour latency into 5-minute buckets', () => {
    const base = new Date('2026-11-21T12:00:10.000Z');
    const second = new Date('2026-11-21T12:02:10.000Z');
    const chart = aggregateChartData([
      { checked_at: base.toISOString(), status: 'up', latency_ms: 10 },
      { checked_at: second.toISOString(), status: 'up', latency_ms: 30 },
      { checked_at: second.toISOString(), status: 'down', latency_ms: null }
    ], '24h');

    expect(chart.aggregated).toBe(true);
    expect(chart.bucket_ms).toBe(5 * 60 * 1000);
    expect(chart.points).toHaveLength(1);
    expect(chart.points[0]).toMatchObject({
      average_latency_ms: 20,
      min_latency_ms: 10,
      max_latency_ms: 30,
      failed_checks: 1
    });
  });
});
