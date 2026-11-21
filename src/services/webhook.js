import { config } from '../config.js';

export function formatTarget(monitor) {
  if (monitor.type === 'tcp' && monitor.port) {
    return `${monitor.target}:${monitor.port}`;
  }
  return monitor.target;
}

export function truncateMessage(message, maximumLength = 1800) {
  return message.length <= maximumLength
    ? message
    : `${message.slice(0, maximumLength - 1)}…`;
}

export function formatDownWebhookMessage(monitor, reason, timestamp = new Date().toISOString()) {
  return truncateMessage(
    `🔴 NetWatch: ${monitor.name} is DOWN (${monitor.type} ${formatTarget(monitor)}). Reason: ${reason || 'Monitor became unreachable'}. Time: ${timestamp}`
  );
}

export function formatRecoveryWebhookMessage(monitor, downtime, timestamp = new Date().toISOString()) {
  return truncateMessage(
    `🟢 NetWatch: ${monitor.name} is back UP (${monitor.type} ${formatTarget(monitor)}). Downtime: ${downtime}. Time: ${timestamp}`
  );
}

export function formatDowntime(startedAt, endedAt) {
  if (!startedAt) return 'unknown';
  const milliseconds = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

export function shouldSendStatusWebhook(fromStatus, toStatus) {
  if (toStatus === 'down') return true;
  if (toStatus === 'up') return fromStatus === 'down';
  return false;
}

export function buildWebhookPayload(message) {
  return JSON.stringify({
    content: message,
    text: message
  });
}

export async function sendStatusWebhook(message) {
  if (!config.webhookUrl) return;
  const payload = buildWebhookPayload(truncateMessage(message));

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      console.warn(`Webhook warning: HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn(`Webhook warning: ${error.name === 'TimeoutError' ? 'request timed out' : 'delivery failed'}`);
  }
}
