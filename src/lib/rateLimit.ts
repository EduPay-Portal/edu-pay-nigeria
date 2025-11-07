/**
 * Client-side rate limiting for authentication endpoints
 * Note: This is a basic protection layer. Production apps should implement
 * server-side rate limiting via Supabase Edge Functions or API Gateway.
 */

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

interface RateLimitRecord {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const configs: Record<string, RateLimitConfig> = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  },
  signup: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
  resetPassword: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
};

export class RateLimiter {
  private attempts: Map<string, RateLimitRecord>;

  constructor() {
    this.attempts = new Map();
  }

  check(
    identifier: string,
    type: keyof typeof configs
  ): { allowed: boolean; retryAfter?: number } {
    const config = configs[type];
    const key = `${type}:${identifier}`;
    const now = Date.now();
    const record = this.attempts.get(key);

    // Check if currently blocked
    if (record?.blockedUntil && record.blockedUntil > now) {
      return {
        allowed: false,
        retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
      };
    }

    // Clean expired records or start new tracking
    if (!record || now - record.firstAttempt > config.windowMs) {
      this.attempts.set(key, { count: 1, firstAttempt: now });
      return { allowed: true };
    }

    // Increment attempts
    record.count++;

    // Block if exceeded max attempts
    if (record.count > config.maxAttempts) {
      record.blockedUntil = now + config.blockDurationMs;
      return {
        allowed: false,
        retryAfter: Math.ceil(config.blockDurationMs / 1000),
      };
    }

    return { allowed: true };
  }

  reset(identifier: string, type: keyof typeof configs) {
    const key = `${type}:${identifier}`;
    this.attempts.delete(key);
  }
}

export const rateLimiter = new RateLimiter();
