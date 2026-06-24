import type { LogLevel, LoggerConfig } from '../types';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export class Logger {
  private config: Required<LoggerConfig>;
  private timers: Map<string, number> = new Map();

  constructor(config?: LoggerConfig) {
    this.config = {
      level: config?.level ?? 'info',
      queries: config?.queries ?? true,
      slowQueryThreshold: config?.slowQueryThreshold ?? 1000,
      format: config?.format ?? 'text',
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    if (this.config.format === 'json') {
      return JSON.stringify({ timestamp, level, message, data });
    }
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const dataStr = data ? ` ${typeof data === 'string' ? data : JSON.stringify(data)}` : '';
    return `${prefix} ${message}${dataStr}`;
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  query(sql: string, duration: number, rowCount: number): void {
    if (this.config.queries && this.shouldLog('info')) {
      const slow = duration >= this.config.slowQueryThreshold ? ' [SLOW]' : '';
      this.info(`Query (${duration}ms, ${rowCount} rows)${slow}: ${sql.substring(0, 200)}`);
      if (sql.length > 200) {
        this.debug(`Full query: ${sql}`);
      }
    }
  }

  startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  endTimer(label: string): number {
    const start = this.timers.get(label);
    if (start === undefined) return 0;
    const duration = Date.now() - start;
    this.timers.delete(label);
    this.debug(`Timer "${label}": ${duration}ms`);
    return duration;
  }

  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
