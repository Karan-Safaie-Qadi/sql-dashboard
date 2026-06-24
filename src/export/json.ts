import type { QueryResult } from '../types';

export interface JSONExportOptions {
  pretty?: boolean;
  indent?: number;
  dateFormat?: 'iso' | 'timestamp';
  includeMeta?: boolean;
}

export function toJSON(result: QueryResult, options: JSONExportOptions = {}): string {
  const {
    pretty = true,
    indent = 2,
    includeMeta = false,
  } = options;

  if (includeMeta) {
    return JSON.stringify({
      meta: {
        rowCount: result.rowCount,
        columns: result.columns,
        duration: result.duration,
        status: result.status,
      },
      data: result.rows,
    }, null, pretty ? indent : undefined);
  }

  return JSON.stringify(result.rows, null, pretty ? indent : undefined);
}

export function toJSONLines(result: QueryResult): string {
  return result.rows.map((row) => JSON.stringify(row)).join('\n');
}

export function toJSONArray(result: QueryResult): string {
  return JSON.stringify(result.rows);
}
