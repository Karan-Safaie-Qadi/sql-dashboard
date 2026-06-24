export type QueryStatus = 'success' | 'error' | 'cancelled';

export interface QueryOptions {
  timeout?: number;
  params?: unknown[];
  readOnly?: boolean;
  transaction?: boolean;
  stream?: boolean;
  maxRows?: number;
}

export interface QueryResult {
  id: string;
  status: QueryStatus;
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  affectedRows?: number;
  duration: number;
  query: string;
  error?: string;
  warning?: string;
  insertedId?: string | number;
}

export interface QueryExecution {
  id: string;
  query: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: QueryStatus;
  result?: QueryResult;
  error?: Error;
}

export interface QueryHistoryEntry {
  id: string;
  query: string;
  executedAt: Date;
  duration: number;
  status: QueryStatus;
  rowCount: number;
  database: string;
  user?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type TransactionCallback<T = unknown> = (
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>
) => Promise<T>;

export interface PreparedStatement {
  id: string;
  sql: string;
  params: string[];
  createdAt: Date;
}
