type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  module: string;
  action: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

function log(level: LogLevel, module: string, action: string, message: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    module,
    action,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${module}:${action}]`;

  switch (level) {
    case 'error':
      console.error(prefix, message, data ? JSON.stringify(data) : '');
      break;
    case 'warn':
      console.warn(prefix, message, data ? JSON.stringify(data) : '');
      break;
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.log(prefix, message, data ? JSON.stringify(data) : '');
      }
      break;
    default:
      console.log(prefix, message, data ? JSON.stringify(data) : '');
  }

  return entry;
}

export function createLogger(module: string) {
  return {
    info: (action: string, message: string, data?: Record<string, unknown>) => log('info', module, action, message, data),
    warn: (action: string, message: string, data?: Record<string, unknown>) => log('warn', module, action, message, data),
    error: (action: string, message: string, data?: Record<string, unknown>) => log('error', module, action, message, data),
    debug: (action: string, message: string, data?: Record<string, unknown>) => log('debug', module, action, message, data),
  };
}
