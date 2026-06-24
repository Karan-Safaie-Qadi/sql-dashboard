export interface FormatOptions {
  uppercase?: boolean;
  indent?: string;
}

export function formatSQL(sql: string, options: FormatOptions = {}): string {
  const {
    uppercase = true,
    indent = '  ',
  } = options;

  let formatted = sql.trim();

  if (uppercase) {
    formatted = uppercaseKeywords(formatted);
  }

  formatted = formatClauses(formatted, indent);
  formatted = formatParentheses(formatted, indent);
  formatted = formatCommas(formatted);
  formatted = formatOperators(formatted);

  return formatted;
}

const KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL',
  'LIKE', 'BETWEEN', 'EXISTS', 'HAVING', 'GROUP BY', 'ORDER BY',
  'LIMIT', 'OFFSET', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
  'OUTER JOIN', 'FULL JOIN', 'CROSS JOIN', 'ON', 'AS',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
  'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE',
  'CREATE INDEX', 'DROP INDEX', 'CREATE VIEW', 'DROP VIEW',
  'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'ASC', 'DESC', 'DISTINCT', 'ALL', 'TOP',
  'WITH', 'RECURSIVE', 'RETURNING',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
];

function uppercaseKeywords(sql: string): string {
  const pattern = new RegExp(`\\b(${KEYWORDS.join('|')})\\b`, 'gi');
  return sql.replace(pattern, (match) => match.toUpperCase());
}

function formatClauses(sql: string, indent: string): string {
  const clausePatterns = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING',
    'ORDER BY', 'LIMIT', 'OFFSET',
    'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
  ];

  for (const clause of clausePatterns) {
    const regex = new RegExp(`\\b${clause}\\b`, 'i');
    sql = sql.replace(regex, `\n${clause}`);
  }

  const joinPatterns = [
    'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
    'OUTER JOIN', 'FULL JOIN', 'CROSS JOIN',
    'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
  ];

  for (const clause of joinPatterns) {
    const regex = new RegExp(`\\n${clause}\\b`, 'i');
    if (regex.test(sql)) continue;
    const inlineRegex = new RegExp(`\\b${clause}\\b`, 'i');
    sql = sql.replace(inlineRegex, `\n${clause}`);
  }

  const lines = sql.split('\n').map((line) => line.trim());
  return lines
    .map((line, i) => {
      if (i > 0 && !line.startsWith(indent)) {
        const trimmed = line.trim();
        if (trimmed.length > 0 && !KEYWORDS.some((kw) => trimmed.toUpperCase().startsWith(kw))) {
          return indent + line;
        }
      }
      return line || '';
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function formatParentheses(sql: string, indent: string): string {
  let depth = 0;
  return sql
    .split('')
    .map((char) => {
      if (char === '(') {
        depth++;
        return `(\n${indent.repeat(depth)}`;
      }
      if (char === ')') {
        depth--;
        return `\n${indent.repeat(depth)})`;
      }
      return char;
    })
    .join('');
}

function formatCommas(sql: string): string {
  return sql.replace(/,\s*/g, ', ');
}

function formatOperators(sql: string): string {
  return sql
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s*!=\s*/g, ' != ')
    .replace(/\s*<>\s*/g, ' <> ')
    .replace(/\s*>\s*/g, ' > ')
    .replace(/\s*<\s*/g, ' < ')
    .replace(/\s*>=\s*/g, ' >= ')
    .replace(/\s*<=\s*/g, ' <= ')
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/\s*-\s*/g, ' - ');
}

export function formatResultRow(
  row: Record<string, unknown>,
  columns?: string[]
): Record<string, unknown> {
  const formatted: Record<string, unknown> = {};
  const cols = columns || Object.keys(row);

  for (const col of cols) {
    const value = row[col];
    if (value === null || value === undefined) {
      formatted[col] = 'NULL';
    } else if (Buffer.isBuffer(value)) {
      formatted[col] = `[Buffer ${value.length} bytes]`;
    } else if (value instanceof Date) {
      formatted[col] = value.toISOString();
    } else if (typeof value === 'object') {
      formatted[col] = JSON.stringify(value);
    } else {
      formatted[col] = value;
    }
  }

  return formatted;
}

export function truncateResult(
  rows: Record<string, unknown>[],
  maxRows: number
): { rows: Record<string, unknown>[]; truncated: boolean } {
  if (rows.length <= maxRows) {
    return { rows, truncated: false };
  }
  return { rows: rows.slice(0, maxRows), truncated: true };
}
