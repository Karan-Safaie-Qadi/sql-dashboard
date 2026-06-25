import type { RateLimitConfig } from '../types';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private config: Required<RateLimitConfig>;
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      enabled: true,
      windowMs: 60000,
      maxQueries: 100,
      maxQueriesPerUser: {},
      errorMessage: 'Too many queries. Please slow down.',
      ...config,
    };

    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number; error?: string } {
    if (!this.config.enabled) {
      return { allowed: true, remaining: Infinity, resetAt: 0 };
    }

    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      const maxQueries = key in this.config.maxQueriesPerUser ? this.config.maxQueriesPerUser[key] : this.config.maxQueries;
      if (maxQueries <= 0) {
        return { allowed: false, remaining: 0, resetAt: now + this.config.windowMs, error: this.config.errorMessage };
      }
      this.store.set(key, {
        count: 1,
        resetAt: now + this.config.windowMs,
      });
      return { allowed: true, remaining: maxQueries - 1, resetAt: now + this.config.windowMs };
    }

    const maxQueries = key in this.config.maxQueriesPerUser ? this.config.maxQueriesPerUser[key] : this.config.maxQueries;
    entry.count++;

    if (entry.count > maxQueries) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        error: this.config.errorMessage,
      };
    }

    return { allowed: true, remaining: maxQueries - entry.count, resetAt: entry.resetAt };
  }

  getRemaining(key: string): number {
    const entry = this.store.get(key);
    const maxQueries = key in this.config.maxQueriesPerUser ? this.config.maxQueriesPerUser[key] : this.config.maxQueries;
    if (maxQueries <= 0) return 0;
    if (!entry || entry.resetAt <= Date.now()) {
      return maxQueries;
    }
    return Math.max(0, maxQueries - entry.count);
  }

  reset(key?: string): void {
    if (key) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}
