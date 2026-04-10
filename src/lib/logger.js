import { PLATFORM_USER_KEY } from '@/features/auth/utils/authInit';

const SENSITIVE_KEY_REGEX = /(password|token|secret|authorization|cookie)/i;

function sanitize(value, depth = 0) {
  if (value == null || depth > 4) return value;
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry, depth + 1));
  if (typeof value !== 'object') return value;

  return Object.entries(value).reduce((acc, [key, nestedValue]) => {
    acc[key] = SENSITIVE_KEY_REGEX.test(key) ? '[REDACTED]' : sanitize(nestedValue, depth + 1);
    return acc;
  }, {});
}

function getCurrentUserId() {
  try {
    const raw = localStorage.getItem(PLATFORM_USER_KEY);
    if (!raw) return 'anonymous';
    const user = JSON.parse(raw);
    return user?.id || user?.userId || user?.email || 'anonymous';
  } catch {
    return 'anonymous';
  }
}

function baseContext() {
  return {
    timestamp: new Date().toISOString(),
    userId: getCurrentUserId(),
    route: window.location.pathname || '/',
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
  sanitize,
};

export default logger;
