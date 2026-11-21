export function parsePingLatency(output) {
  if (typeof output !== 'string') {
    return null;
  }

  // Windows writes "time=12ms"; Linux and macOS write "time=12.3 ms".
  const windowsMatch = output.match(/time[=<]\s*(\d+(?:[.,]\d+)?)\s*ms/i);
  if (windowsMatch) {
    return Number(windowsMatch[1].replace(',', '.'));
  }

  const unixMatch = output.match(/(?:time=|time <)\s*(\d+(?:[.,]\d+)?)\s*ms/i);
  return unixMatch ? Number(unixMatch[1].replace(',', '.')) : null;
}

export function mapPingFailure(error, stdout = '', stderr = '') {
  const text = `${stdout}\n${stderr}\n${error?.message || ''}`.toLowerCase();
  if (
    text.includes('request timed out')
    || text.includes('100% packet loss')
    || text.includes('packets received 0')
  ) {
    return 'Request timed out';
  }
  if (
    text.includes('destination host unreachable')
    || text.includes('destination net unreachable')
  ) {
    return 'Destination host unreachable';
  }
  if (
    text.includes('general failure')
    || text.includes('transmit failed')
  ) {
    return 'Ping failed';
  }
  if (text.includes('ttl expired in transit')) {
    return 'Ping failed';
  }
  if (
    text.includes('host not found')
    || text.includes('unknown host')
    || text.includes('name or service not known')
    || text.includes('could not find host')
  ) {
    return 'Host not found';
  }
  return 'Ping failed';
}
