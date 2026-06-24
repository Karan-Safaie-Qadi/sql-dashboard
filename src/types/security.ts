export interface RateLimitConfig {
  enabled?: boolean;
  windowMs?: number;
  maxQueries?: number;
  maxQueriesPerUser?: Record<string, number>;
  errorMessage?: string;
}

export interface ReadOnlyRule {
  enabled?: boolean;
  allowSelect?: boolean;
  allowShow?: boolean;
  allowDescribe?: boolean;
  allowExplain?: boolean;
  bypassUsers?: string[];
}

export interface SecurityConfig {
  readOnly?: boolean | ReadOnlyRule;
  rateLimit?: RateLimitConfig;
  maxQueryLength?: number;
  maxRows?: number;
  bannedStatements?: string[];
  bannedDatabases?: string[];
  allowedDatabases?: string[];
  requireWhere?: boolean;
  queryTimeout?: number;
  allowedHosts?: string[];
}

export interface ValidationError {
  code: string;
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  normalizedQuery: string;
  statementType: string;
  isReadOnly: boolean;
  tables: string[];
}
