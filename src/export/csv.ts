import type { QueryResult } from '../types';

export interface CSVExportOptions {
  delimiter?: string;
  includeHeader?: boolean;
  quoteAll?: boolean;
  encoding?: string;
  nullValue?: string;
}

export function toCSV(result: QueryResult, options: CSVExportOptions = {}): string {
  const {
    delimiter = ',',
    includeHeader = true,
    quoteAll = true,
    nullValue = 'NULL',
  } = options;

  const lines: string[] = [];

  if (includeHeader && result.columns.length > 0) {
    lines.push(result.columns.map((col) => formatCSVField(col, delimiter, quoteAll)).join(delimiter));
  }

  for (const row of result.rows) {
    const line = result.columns.map((col) => {
      const value = row[col];
      if (value === null || value === undefined) return nullValue;
      return formatCSVField(String(value), delimiter, quoteAll);
    });
    lines.push(line.join(delimiter));
  }

  return lines.join('\r\n');
}

function formatCSVField(value: string, delimiter: string, quoteAll: boolean): string {
  const needsQuoting = quoteAll || value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r');
  if (needsQuoting) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCSVStream(result: QueryResult, options: CSVExportOptions = {}): NodeJS.ReadableStream {
  const { Readable } = require('stream');
  const csv = toCSV(result, options);
  const stream = new Readable();
  stream.push(csv);
  stream.push(null);
  return stream;
}
