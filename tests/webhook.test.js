import { describe, expect, it } from 'vitest';
import {
  buildWebhookPayload,
  formatDownWebhookMessage,
  formatDowntime,
  formatRecoveryWebhookMessage,
  formatTarget,
  shouldSendStatusWebhook,
  truncateMessage
} from '../src/services/webhook.js';

describe('webhook messages', () => {
  it('formats a down message for a TCP monitor', () => {
    const message = formatDownWebhookMessage(
      { name: 'Office router', type: 'tcp', target: '192.168.1.1', port: 443 },
      'TCP connection timed out',
      '2026-11-21T15:00:00.000Z'
    );
    expect(message).toBe(
      '🔴 NetWatch: Office router is DOWN (tcp 192.168.1.1:443). Reason: TCP connection timed out. Time: 2026-11-21T15:00:00.000Z'
    );
  });

  it('formats a recovery message for an HTTP monitor', () => {
    const message = formatRecoveryWebhookMessage(
      { name: 'Website', type: 'http', target: 'https://example.com', port: null },
      '2h 5m',
      '2026-11-21T17:05:00.000Z'
    );
    expect(message).toBe(
      '🟢 NetWatch: Website is back UP (http https://example.com). Downtime: 2h 5m. Time: 2026-11-21T17:05:00.000Z'
    );
  });

  it('formats monitor targets without a port for ping and HTTP', () => {
    expect(formatTarget({ type: 'ping', target: '192.168.1.104' })).toBe('192.168.1.104');
    expect(formatTarget({ type: 'http', target: 'https://example.com' })).toBe('https://example.com');
  });

  it('truncates messages to 1,800 characters', () => {
    const message = truncateMessage(`A${'x'.repeat(1900)}Z`);
    expect(message.length).toBe(1800);
  });

  it('builds a payload with both Discord and Slack fields', () => {
    const payload = JSON.parse(buildWebhookPayload('Test alert'));
    expect(payload).toEqual({
      content: 'Test alert',
      text: 'Test alert'
    });
  });

  it('formats downtime in a short readable form', () => {
    expect(formatDowntime(
      '2026-11-21T12:00:00.000Z',
      '2026-11-21T14:05:07.000Z'
    )).toBe('2h 5m');
  });

  it('does not alert on unknown to up', () => {
    expect(shouldSendStatusWebhook('unknown', 'up')).toBe(false);
  });

  it('alerts for down and recovery from down', () => {
    expect(shouldSendStatusWebhook('up', 'down')).toBe(true);
    expect(shouldSendStatusWebhook('unknown', 'down')).toBe(true);
    expect(shouldSendStatusWebhook('down', 'up')).toBe(true);
  });
});
