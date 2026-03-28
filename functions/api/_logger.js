// functions/api/_logger.js
// Structured logging for Cloudflare Workers.
// Outputs JSON to console for consumption by Cloudflare Logpush or Tail.

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level, operation, message, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    operation,
    message,
    ...metadata,
  };

  if (LEVELS[level] >= LEVELS.error) {
    console.error(JSON.stringify(entry));
  } else if (LEVELS[level] >= LEVELS.warn) {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export function logInfo(operation, message, metadata) {
  log('info', operation, message, metadata);
}

export function logWarn(operation, message, metadata) {
  log('warn', operation, message, metadata);
}

export function logError(operation, message, metadata) {
  log('error', operation, message, metadata);
}

/**
 * Log request metadata (method, path, status, duration).
 * Call at the end of a request handler.
 */
export function logRequest(request, status, startTime) {
  const url = new URL(request.url);
  log('info', 'request', `${request.method} ${url.pathname} ${status}`, {
    method: request.method,
    path: url.pathname,
    status,
    durationMs: Date.now() - startTime,
  });
}
