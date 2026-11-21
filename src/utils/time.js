export function rangeCutoff(range = '24h') {
  const milliseconds = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  return new Date(Date.now() - (milliseconds[range] || milliseconds['24h'])).toISOString();
}

export function validateRange(range) {
  return ['1h', '24h', '7d', '30d'].includes(range);
}
