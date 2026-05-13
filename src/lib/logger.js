const SENSITIVE_KEY_REGEX = /(password|token|secret|authorization|cookie)/i;

let currentUserId = 'anonymous';

function sanitize(value, depth = 0) {
  if (value == null || depth > 4) return value;
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry, depth + 1));
  if (typeof value !== 'object') return value;

  return Object.entries(value).reduce((acc, [key, nestedValue]) => {
    acc[key] = SENSITIVE_KEY_REGEX.test(key) ? '[REDACTED]' : sanitize(nestedValue, depth + 1);
    return acc;
  }, {});
}

function baseContext() {
  return {
    timestamp: new Date().toISOString(),
    userId: currentUserId,
    route: typeof window !== 'undefined' ? window.location.pathname : '/',
  };
}

function emit(level, message, metadata = {}) {
  const payload = {
    ...baseContext(),
    level,
    message,
    metadata: sanitize(metadata),
  };

  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
  console[method]('[UI_LOG]', payload);
  return payload;
}

export const logger = {
  info: (message, metadata) => emit('info', message, metadata),
  warn: (message, metadata) => emit('warn', message, metadata),
  error: (message, metadata) => emit('error', message, metadata),
  /**
   * Sets the user ID for auditing in all subsequent logs.
   * Call this from AuthProvider when the user session is loaded.
   */
  setUser: (userId) => {
    currentUserId = userId || 'anonymous';
  },
  sanitize,
};

export default logger;
