export function insertGapBreaks(points, thresholdMs) {
  if (points.length < 2) return points;
  const result = [];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    result.push(point);
    if (index === points.length - 1) continue;

    const next = points[index + 1];
    if (next.x - point.x > thresholdMs) {
      result.push({ x: Math.floor((point.x + next.x) / 2), y: null });
    }
  }
  return result;
}

export function formatChartTimestamp(timestamp, range) {
  const date = new Date(timestamp);
  if (range === '1h' || range === '24h') {
    return new Intl.DateTimeFormat([], {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(date);
  }
  return new Intl.DateTimeFormat([], {
    month: 'short',
    day: 'numeric'
  }).format(date);
}
