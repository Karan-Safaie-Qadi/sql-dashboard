export class DashboardError extends Error {
  public code: string;
  public statusCode: number;
  public details?: Record<string, unknown>;

  constructor(message: string, code: string, statusCode: number = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DashboardError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ConnectionError extends DashboardError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONNECTION_ERROR', 500, details);
    this.name = 'ConnectionError';
  }
}

export class QueryError extends DashboardError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'QUERY_ERROR', 400, details);
    this.name = 'QueryError';
  }
}

export class ValidationError extends DashboardError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends DashboardError {
  constructor(timeout: number) {
    super(`Query timed out after ${timeout}ms`, 'TIMEOUT', 408);
    this.name = 'TimeoutError';
  }
}

export class ReadOnlyError extends DashboardError {
  constructor() {
    super('Database is in read-only mode', 'READ_ONLY', 403);
    this.name = 'ReadOnlyError';
  }
}

export class RateLimitError extends DashboardError {
  constructor(retryAfter: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', 429, { retryAfter });
    this.name = 'RateLimitError';
  }
}
