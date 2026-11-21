import { config } from '../config.js';

export async function sendStatusWebhook(monitorName, fromStatus, toStatus) {
  if (!config.webhookUrl) return;

  const payload = JSON.stringify({
    text: `NetWatch: ${monitorName} changed from ${fromStatus} to ${toStatus}`
  });

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      console.error(`Webhook returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('Webhook notification failed:', error.message);
  }
}
