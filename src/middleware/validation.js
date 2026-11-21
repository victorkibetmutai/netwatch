const HOSTNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
const URL_PATTERN = /^https?:\/\/[^\s"'`;|<>]+$/i;

export function isValidHostname(value) {
  return typeof value === 'string'
    && value.length <= 253
    && HOSTNAME_PATTERN.test(value)
    && value.split('.').every((label) => label.length > 0 && label.length <= 63);
}

export function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !URL_PATTERN.test(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isIntegerInRange(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function validateMonitorInput(input, { partial = false } = {}) {
  const errors = [];
  const allowedFields = new Set([
    'name', 'type', 'target', 'port', 'interval_seconds', 'timeout_ms',
    'expected_status', 'failure_threshold', 'enabled'
  ]);

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['Request body must be an object'];
  }

  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      errors.push(`Unknown field: ${field}`);
    }
  }

  const required = ['name', 'type', 'target'];
  for (const field of required) {
    if (!partial && (input[field] === undefined || input[field] === null)) {
      errors.push(`${field} is required`);
    }
  }

  if (input.name !== undefined
    && (typeof input.name !== 'string' || input.name.trim().length === 0 || input.name.length > 60)) {
    errors.push('name must be a non-empty string of 60 characters or fewer');
  }

  if (input.type !== undefined && !['ping', 'tcp', 'http'].includes(input.type)) {
    errors.push('type must be ping, tcp, or http');
  }

  if (input.target !== undefined) {
    const targetIsValid = input.type === 'http'
      ? isValidHttpUrl(input.target)
      : isValidHostname(input.target);
    if (!targetIsValid) {
      errors.push(input.type === 'http'
        ? 'target must be a valid http or https URL'
        : 'target must be a valid hostname or IP address');
    }
  }

  if (input.port !== undefined && !isIntegerInRange(input.port, 1, 65535)) {
    errors.push('port must be an integer from 1 to 65535');
  }
  if (input.interval_seconds !== undefined && !isIntegerInRange(input.interval_seconds, 10, 86400)) {
    errors.push('interval_seconds must be an integer from 10 to 86400');
  }
  if (input.timeout_ms !== undefined && !isIntegerInRange(input.timeout_ms, 1, 30000)) {
    errors.push('timeout_ms must be an integer from 1 to 30000');
  }
  if (input.expected_status !== undefined && !isIntegerInRange(input.expected_status, 100, 599)) {
    errors.push('expected_status must be an integer from 100 to 599');
  }
  if (input.failure_threshold !== undefined && !isIntegerInRange(input.failure_threshold, 1, 100)) {
    errors.push('failure_threshold must be an integer from 1 to 100');
  }
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  const type = input.type;
  if (type === 'tcp' && input.port === undefined && !partial) {
    errors.push('port is required for tcp monitors');
  }
  if (type !== 'tcp' && input.port !== undefined) {
    errors.push('port is only allowed for tcp monitors');
  }
  if (type !== 'http' && input.expected_status !== undefined) {
    errors.push('expected_status is only allowed for http monitors');
  }

  return errors;
}

export function validationMiddleware(request, response, next) {
  const errors = validateMonitorInput(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ error: errors.join('; ') });
  }
  next();
}

export function partialValidationMiddleware(request, response, next) {
  const errors = validateMonitorInput(request.body, { partial: true });
  if (errors.length > 0) {
    return response.status(400).json({ error: errors.join('; ') });
  }
  next();
}
