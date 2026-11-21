import { apiRequest } from './api.js';
import { formatChartTimestamp, insertGapBreaks } from './chartUtils.js';

const monitorId = new URLSearchParams(window.location.search).get('id');
const rangeSelect = document.getElementById('range-select');
const detailError = document.getElementById('detail-error');
let latencyChart = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showError(message) {
  detailError.textContent = message;
  detailError.classList.remove('hidden');
}

function clearError() {
  detailError.textContent = '';
  detailError.classList.add('hidden');
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Ongoing';
}

function formatDuration(startedAt, endedAt) {
  if (!endedAt) return 'Ongoing';
  const milliseconds = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (milliseconds < 0) return '—';
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

async function loadDetail() {
  if (!monitorId) {
    showError('Monitor ID is missing.');
    return;
  }
  clearError();

  try {
    const range = rangeSelect.value;
    const [monitor, stats, checks, chart, incidents] = await Promise.all([
      apiRequest(`/api/monitors/${monitorId}`),
      apiRequest(`/api/monitors/${monitorId}/stats?range=${range}`),
      apiRequest(`/api/monitors/${monitorId}/checks?range=${range}`),
      apiRequest(`/api/monitors/${monitorId}/chart?range=${range}`),
      apiRequest(`/api/incidents?monitor_id=${monitorId}`)
    ]);

    const status = monitor.enabled ? (monitor.current_status || 'unknown') : 'paused';
    document.title = `${monitor.name} - NetWatch`;
    document.getElementById('detail-name').textContent = monitor.name;
    const statusLabel = document.getElementById('detail-status');
    statusLabel.textContent = status;
    statusLabel.className = `status-label ${status}`;
    document.getElementById('detail-type').textContent = monitor.type.toUpperCase();
    document.getElementById('detail-target').textContent = monitor.target;
    document.getElementById('detail-check').disabled = !monitor.enabled;

    renderStats(stats);
    renderChart(chart, monitor.interval_seconds);
    renderChecks(checks);
    renderIncidents(incidents);
  } catch (error) {
    showError(error.message);
  }
}

function renderStats(stats) {
  const cards = [
    ['Uptime', `${stats.uptime_percentage}%`],
    ['Average', stats.average_latency_ms === null ? '—' : `${stats.average_latency_ms} ms`],
    ['Minimum', stats.min_latency_ms === null ? '—' : `${stats.min_latency_ms} ms`],
    ['Maximum', stats.max_latency_ms === null ? '—' : `${stats.max_latency_ms} ms`],
    ['Total checks', stats.total_checks]
  ];
  document.getElementById('detail-stats').innerHTML = cards.map(([label, value]) =>
    `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`
  ).join('');
}

function renderChart(chartData, intervalSeconds) {
  const chronological = chartData.points || [];
  const range = rangeSelect.value;
  const successfulLatencies = chronological
    .map((point) => chartData.aggregated
      ? point.average_latency_ms
      : point.status === 'up' ? point.latency_ms : null)
    .filter((latency) => typeof latency === 'number');
  const rawData = chronological
    .map((point) => chartData.aggregated
      ? (typeof point.average_latency_ms === 'number'
        ? { x: new Date(point.timestamp).getTime(), y: point.average_latency_ms, raw: point }
        : null)
      : (point.status === 'up' && typeof point.latency_ms === 'number'
        ? { x: new Date(point.timestamp).getTime(), y: point.latency_ms, raw: point }
        : null))
    .filter((point) => point !== null);
  const gapThresholdMs = chartData.aggregated
    ? chartData.bucket_ms * 3
    : intervalSeconds * 3 * 1000;
  const data = insertGapBreaks(rawData, gapThresholdMs);
  const suggestedMaximum = successfulLatencies.length === 0
    ? undefined
    : Math.ceil(Math.max(...successfulLatencies) * 1.15);
  const failureMarkers = chronological
    .map((point) => chartData.aggregated
      ? (point.failed_checks > 0
        ? { x: new Date(point.timestamp).getTime(), y: 0, raw: point }
        : null)
      : (point.status === 'down'
        ? { x: new Date(point.timestamp).getTime(), y: 0, raw: point }
        : null))
    .filter((marker) => marker !== null);
  const timeUnit = range === '1h'
    ? 'minute'
    : range === '24h'
      ? 'hour'
      : 'day';
  const chartConfig = {
    type: 'line',
    data: {
      datasets: [{
        label: 'Latency (ms)',
        data,
        borderColor: '#7c9cff',
        backgroundColor: 'rgba(124, 156, 255, 0.12)',
        pointBackgroundColor: '#7c9cff',
        pointBorderColor: '#7c9cff',
        pointRadius: rawData.length > 40 ? 2 : 4,
        spanGaps: false,
        tension: 0,
        fill: true
      }, {
        type: 'scatter',
        label: 'Failure',
        data: failureMarkers,
        backgroundColor: '#ff6b7a',
        borderColor: '#ff6b7a',
        pointStyle: 'triangle',
        pointRadius: 7,
        pointHoverRadius: 9,
        showLine: false
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: suggestedMaximum,
          title: { display: true, text: 'Milliseconds' }
        },
        x: {
          type: 'time',
          time: {
            unit: timeUnit,
            displayFormats: range === '1h' || range === '24h'
              ? { minute: 'HH:mm', hour: 'HH:mm' }
              : { day: 'MMM d' }
          },
          ticks: { maxTicksLimit: 8, source: 'auto' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111827',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#7c9cff',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            title(items) {
              if (!items.length) return '';
              return formatChartTimestamp(items[0].parsed.x, range);
            },
            label(context) {
              if (context.dataset.label === 'Failure') return 'Failed';
              const latency = context.parsed.y;
              if (typeof latency !== 'number') return 'No data';
              const raw = context.raw?.raw;
              if (chartData.aggregated && raw) {
                return `Average ${raw.average_latency_ms} ms · Min ${raw.min_latency_ms ?? '—'} ms · Max ${raw.max_latency_ms ?? '—'} ms · Failed ${raw.failed_checks}`;
              }
              return `${latency} ms`;
            }
          }
        }
      }
    }
  };

  if (latencyChart) {
    latencyChart.data = chartConfig.data;
    latencyChart.options = chartConfig.options;
    latencyChart.update('none');
  } else {
    latencyChart = new Chart(document.getElementById('latency-chart'), chartConfig);
  }
}

function renderChecks(checks) {
  const body = document.getElementById('checks-table');
  if (checks.length === 0) {
    body.innerHTML = '<tr><td colspan="5">No checks in this range.</td></tr>';
    return;
  }
  body.innerHTML = checks.map((check) =>
    `<tr>
      <td>${escapeHtml(formatDate(check.checked_at))}</td>
      <td><span class="status-label ${escapeHtml(check.status)}">${escapeHtml(check.status)}</span></td>
      <td>${check.status === 'down'
        ? escapeHtml(check.error?.includes('timed out') || check.error?.includes('timeout') ? 'Timed out' : 'Failed')
        : `${escapeHtml(check.latency_ms)} ms`}</td>
      <td>${escapeHtml(check.status_code ?? '—')}</td>
      <td>${escapeHtml(check.error ?? '—')}</td>
    </tr>`
  ).join('');
}

function renderIncidents(incidents) {
  const body = document.getElementById('incidents-table');
  if (incidents.length === 0) {
    body.innerHTML = '<tr><td colspan="4">No incidents recorded.</td></tr>';
    return;
  }
  body.innerHTML = incidents.map((incident) =>
    `<tr>
      <td>${escapeHtml(formatDate(incident.started_at))}</td>
      <td>${escapeHtml(formatDate(incident.ended_at))}</td>
      <td>${escapeHtml(formatDuration(incident.started_at, incident.ended_at))}</td>
      <td>${escapeHtml(incident.reason)}</td>
    </tr>`
  ).join('');
}

rangeSelect.addEventListener('change', loadDetail);
document.getElementById('detail-check').addEventListener('click', async () => {
  try {
    await apiRequest(`/api/monitors/${monitorId}/check`, { method: 'POST', body: '{}' });
    await loadDetail();
  } catch (error) {
    showError(error.message);
  }
});

loadDetail();

const eventSource = new EventSource('/api/events');
eventSource.addEventListener('check', (event) => {
  const data = JSON.parse(event.data);
  if (Number(data.monitor_id) === Number(monitorId)) loadDetail();
});
eventSource.addEventListener('status-change', (event) => {
  const data = JSON.parse(event.data);
  if (Number(data.monitor_id) === Number(monitorId)) loadDetail();
});
