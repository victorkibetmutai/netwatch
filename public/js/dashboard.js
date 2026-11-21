import { apiRequest } from './api.js';

const grid = document.getElementById('monitor-grid');
const searchInput = document.getElementById('monitor-search');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const emptyMessage = document.getElementById('empty-message');
const globalError = document.getElementById('global-error');
const modal = document.getElementById('monitor-modal');
const form = document.getElementById('monitor-form');
const formError = document.getElementById('form-error');
let monitors = [];
let activeFilter = 'all';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showError(message) {
  globalError.textContent = message;
  globalError.classList.remove('hidden');
}

function clearError() {
  globalError.textContent = '';
  globalError.classList.add('hidden');
}

async function loadDashboard() {
  loadingState.classList.remove('hidden');
  grid.innerHTML = '';
  clearError();
  try {
    const [monitorData, summary] = await Promise.all([
      apiRequest('/api/monitors'),
      apiRequest('/api/summary')
    ]);
    monitors = monitorData;
    renderSummary(summary);
    renderMonitors();
  } catch (error) {
    showError(error.message);
  } finally {
    loadingState.classList.add('hidden');
  }
}

function renderSummary(summary) {
  const cards = [
    ['Total monitors', summary.monitors],
    ['Up', summary.up],
    ['Down', summary.down],
    ['Average latency', summary.average_latency === null ? '—' : `${summary.average_latency} ms`],
    ['Open incidents', summary.open_incidents]
  ];
  document.getElementById('summary-cards').innerHTML = cards.map(([label, value]) =>
    `<article class="summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>`
  ).join('');
}

function sparklineSvg(values) {
  if (!values || values.length < 2) {
    return '<div class="sparkline-empty">No latency history</div>';
  }
  const width = 180;
  const height = 48;
  const maximum = Math.max(...values, 1);
  const minimum = Math.min(...values);
  const range = Math.max(maximum - minimum, 1);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - minimum) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Latency sparkline">
    <polyline points="${points}" fill="none" vector-effect="non-scaling-stroke"></polyline>
  </svg>`;
}

function monitorStatus(monitor) {
  if (!monitor.enabled) return 'paused';
  return monitor.current_status || 'unknown';
}

function renderMonitors() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = monitors.filter((monitor) => {
    const status = monitorStatus(monitor);
    const matchesFilter = activeFilter === 'all'
      || (activeFilter === 'paused' ? status === 'paused' : status === activeFilter);
    const matchesSearch = monitor.name.toLowerCase().includes(query)
      || monitor.target.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  grid.innerHTML = filtered.map((monitor) => {
    const status = monitorStatus(monitor);
    const uptime = `${monitor.uptime_percentage ?? 100}%`;
    const latency = monitor.last_latency_ms === null ? '—' : `${Math.round(monitor.last_latency_ms)} ms`;
    return `<article class="monitor-card">
      <header class="monitor-card-header">
        <div>
          <div class="monitor-name-row">
            <span class="status-dot ${escapeHtml(status)}"></span>
            <h2><a class="monitor-link" href="/monitor.html?id=${monitor.id}">${escapeHtml(monitor.name)}</a></h2>
          </div>
          <span class="type-badge">${escapeHtml(monitor.type.toUpperCase())}</span>
        </div>
        <span class="status-label ${escapeHtml(status)}">${escapeHtml(status)}</span>
      </header>
      <div class="target" title="${escapeHtml(monitor.target)}">${escapeHtml(monitor.target)}</div>
      <div class="monitor-metrics">
        <div><span>Latency</span><strong>${escapeHtml(latency)}</strong></div>
        <div><span>24h uptime</span><strong>${escapeHtml(uptime)}</strong></div>
      </div>
      ${sparklineSvg(monitor.sparkline)}
      <footer class="card-actions">
        <button class="button small" type="button" data-action="check" data-id="${monitor.id}" ${monitor.enabled ? '' : 'disabled'}>Check now</button>
        <button class="button small" type="button" data-action="toggle" data-id="${monitor.id}">${monitor.enabled ? 'Pause' : 'Resume'}</button>
        <button class="button small" type="button" data-action="edit" data-id="${monitor.id}">Edit</button>
        <a class="button small" href="/monitor.html?id=${monitor.id}">Details</a>
        <button class="button small danger" type="button" data-action="delete" data-id="${monitor.id}">Delete</button>
      </footer>
    </article>`;
  }).join('');

  const noMonitors = monitors.length === 0;
  emptyState.classList.toggle('hidden', filtered.length > 0);
  emptyMessage.textContent = noMonitors
    ? 'Add your first monitor to start watching your network.'
    : 'No monitors match your search and filter.';
}

function openModal(monitor = null) {
  form.reset();
  document.getElementById('monitor-id').value = monitor?.id || '';
  document.getElementById('modal-title').textContent = monitor ? 'Edit monitor' : 'Add monitor';
  document.getElementById('monitor-name').value = monitor?.name || '';
  document.getElementById('monitor-type').value = monitor?.type || 'ping';
  document.getElementById('monitor-target').value = monitor?.target || '';
  document.getElementById('monitor-port').value = monitor?.port || '';
  document.getElementById('monitor-expected-status').value = monitor?.expected_status || 200;
  document.getElementById('monitor-interval').value = monitor?.interval_seconds || 60;
  document.getElementById('monitor-timeout').value = monitor?.timeout_ms || 5000;
  document.getElementById('monitor-failure-threshold').value = monitor?.failure_threshold || 3;
  document.getElementById('monitor-enabled').checked = monitor ? monitor.enabled : true;
  formError.classList.add('hidden');
  updateConditionalFields();
  modal.classList.remove('hidden');
  document.getElementById('monitor-name').focus();
}

function closeModal() {
  modal.classList.add('hidden');
}

function updateConditionalFields() {
  const type = document.getElementById('monitor-type').value;
  document.getElementById('port-group').classList.toggle('hidden', type !== 'tcp');
  document.getElementById('expected-status-group').classList.toggle('hidden', type !== 'http');
}

function validateForm() {
  const name = document.getElementById('monitor-name').value.trim();
  const type = document.getElementById('monitor-type').value;
  const target = document.getElementById('monitor-target').value.trim();
  if (!name || name.length > 60) return 'Name is required and must be 60 characters or fewer.';
  if (!target) return 'Target is required.';
  if (type === 'tcp') {
    const port = Number(document.getElementById('monitor-port').value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return 'TCP port must be from 1 to 65535.';
  }
  if (type === 'http') {
    const status = Number(document.getElementById('monitor-expected-status').value);
    if (!Number.isInteger(status) || status < 100 || status > 599) return 'Expected status must be from 100 to 599.';
  }
  return null;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const validationError = validateForm();
  if (validationError) {
    formError.textContent = validationError;
    formError.classList.remove('hidden');
    return;
  }

  const type = document.getElementById('monitor-type').value;
  const id = document.getElementById('monitor-id').value;
  const payload = {
    name: document.getElementById('monitor-name').value.trim(),
    type,
    target: document.getElementById('monitor-target').value.trim(),
    interval_seconds: Number(document.getElementById('monitor-interval').value),
    timeout_ms: Number(document.getElementById('monitor-timeout').value),
    failure_threshold: Number(document.getElementById('monitor-failure-threshold').value),
    enabled: document.getElementById('monitor-enabled').checked
  };
  if (type === 'tcp') payload.port = Number(document.getElementById('monitor-port').value);
  if (type === 'http') payload.expected_status = Number(document.getElementById('monitor-expected-status').value);

  try {
    await apiRequest(id ? `/api/monitors/${id}` : '/api/monitors', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    closeModal();
    await loadDashboard();
  } catch (error) {
    formError.textContent = error.message;
    formError.classList.remove('hidden');
  }
});

document.getElementById('add-monitor').addEventListener('click', () => openModal());
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('cancel-modal').addEventListener('click', closeModal);
document.getElementById('monitor-type').addEventListener('change', updateConditionalFields);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
});

searchInput.addEventListener('input', renderMonitors);
document.querySelectorAll('.filter-button').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter-button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    renderMonitors();
  });
});

grid.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const monitor = monitors.find((item) => item.id === Number(button.dataset.id));
  if (!monitor) return;

  try {
    if (button.dataset.action === 'check') {
      await apiRequest(`/api/monitors/${monitor.id}/check`, { method: 'POST', body: '{}' });
    } else if (button.dataset.action === 'toggle') {
      await apiRequest(`/api/monitors/${monitor.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !monitor.enabled })
      });
    } else if (button.dataset.action === 'edit') {
      openModal(monitor);
      return;
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm(`Delete "${monitor.name}" and all of its data?`)) return;
      await apiRequest(`/api/monitors/${monitor.id}`, { method: 'DELETE' });
    }
    await loadDashboard();
  } catch (error) {
    showError(error.message);
  }
});

loadDashboard();

// SSE automatically reconnects; reload data after each check or status transition.
const eventSource = new EventSource('/api/events');
eventSource.addEventListener('check', loadDashboard);
eventSource.addEventListener('status-change', loadDashboard);
