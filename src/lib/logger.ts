/**
 * Structured logging utility for production monitoring
 * 
 * SECURITY WARNING: Never log sensitive data such as:
 * - Passwords or password hashes
 * - Authentication tokens or API keys
 * - Full credit card numbers
 * - Personal identifiable information (PII) without hashing
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  userId?: string;
  action?: string;
  resource?: string;
  duration?: number;
  [key: string]: any;
}

class Logger {
  private isDevelopment = import.meta.env.MODE === 'development';

  private log(level: LogLevel, message: string, context?: LogContext) {
    // Skip debug logs in production
    if (!this.isDevelopment && level === 'debug') return;

    const logData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      environment: import.meta.env.MODE,
      ...context,
    };

    // In production, send to monitoring service (Sentry, LogRocket, etc.)
    if (!this.isDevelopment) {
      // TODO: Integrate with error monitoring service
      // Example: Sentry.captureMessage(message, { level, contexts: { custom: context } });
      
      // For now, only log errors to console in production
      if (level === 'error') {
        console.error('[EduPay Error]', JSON.stringify(logData, null, 2));
      }
    } else {
      // Development: Log everything to console with colors
      const consoleFn =
        level === 'error'
          ? console.error
          : level === 'warn'
          ? console.warn
          : console.log;

      const emoji = {
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        debug: '🔍',
      }[level];

      consoleFn(`${emoji} [EduPay ${level.toUpperCase()}]`, message, context || '');
    }
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, {
      ...context,
      errorMessage: error?.message,
      errorStack: this.isDevelopment ? error?.stack : undefined,
    });
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  // Performance logging helper
  startTimer(label: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = Math.round(performance.now() - startTime);
      this.debug(`${label} completed`, { duration });
    };
  }
}

export const logger = new Logger();
