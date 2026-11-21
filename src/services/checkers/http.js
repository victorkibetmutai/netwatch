export async function checkHttp(monitor) {
  let url = monitor.target;
  const startedAt = process.hrtime.bigint();

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), monitor.timeout_ms);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'NetWatch/1.0' }
      });
      clearTimeout(timer);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          return resultForHttp('down', startedAt, response.status, 'Redirect location missing');
        }
        if (redirectCount === 3) {
          return resultForHttp('down', startedAt, response.status, 'Too many redirects');
        }
        url = new URL(location, url).toString();
        continue;
      }

      const status = response.status === monitor.expected_status ? 'up' : 'down';
      const error = status === 'down'
        ? `Expected HTTP ${monitor.expected_status}, received HTTP ${response.status}`
        : null;
      return resultForHttp(status, startedAt, response.status, error);
    } catch (error) {
      clearTimeout(timer);
      return resultForHttp(
        'down',
        startedAt,
        null,
        error.name === 'AbortError' ? 'HTTP request timed out' : (error.message || 'HTTP request failed')
      );
    }
  }

  return resultForHttp('down', startedAt, null, 'Too many redirects');
}

function resultForHttp(status, startedAt, statusCode, error) {
  const latency = Number(process.hrtime.bigint() - startedAt) / 1e6;
  return {
    status,
    latency_ms: status === 'up' ? Math.round(latency * 100) / 100 : null,
    status_code: statusCode,
    error
  };
}
