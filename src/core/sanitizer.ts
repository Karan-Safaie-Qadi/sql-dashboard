const SQL_INJECTION_PATTERNS = [
  /'.*OR.*'='/i,
  /'.*AND.*'='/i,
  /OR\s+'.*'='.*'/i,
  /AND\s+'.*'='.*'/i,
  /\bOR\s+\d+\s*=\s*\d+/i,
  /\bAND\s+\d+\s*=\s*\d+/i,
  /\bOR\s+\w+\s*=\s*\w+/i,
  /\bAND\s+\w+\s*=\s*\w+/i,
  /--\s*$/m,
  /\/\*.*\*\//,
  /;\s*DROP\s+/i,
  /;\s*DELETE\s+/i,
  /;\s*UPDATE\s+/i,
  /;\s*INSERT\s+/i,
  /;\s*EXEC(?:UTE)?\s+/i,
  /\bUNION\s+ALL\s+SELECT\b/i,
  /\bUNION\s+SELECT\b/i,
  /\bINTO\s+OUTFILE\b/i,
  /\bINTO\s+DUMPFILE\b/i,
  /\bLOAD_FILE\s*\(/i,
  /\bpg_sleep\s*\(/i,
  /\bWAITFOR\s+DELAY\b/i,
  /\bBENCHMARK\s*\(/i,
  /\bSLEEP\s*\(/i,
];

const STRING_LITERALS = /'(?:[^'\\]|\\.)*'/g;

export function sanitizeComment(sql: string): string {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/#.*$/gm, '')
    .trim();
}

export function detectInjection(sql: string): boolean {
  const noComments = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const noStrings = noComments.replace(STRING_LITERALS, '');
  if (SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(noStrings))) {
    return true;
  }
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(noComments)) {
      return true;
    }
  }
  return false;
}

export function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_$]/g, '').replace(/^(\d)/, '_$1');
}

export function sanitizeValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  const str = String(value);
  return `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

export function normalizeWhitespace(sql: string): string {
  return sql
    .replace(/\s+/g, ' ')
    .replace(/\s*([,;()])\s*/g, '$1')
    .trim();
}

export function prepareBatchQueries(sql: string): string[] {
  const sanitized = sanitizeComment(sql);
  const queries = sanitized
    .split(';')
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .map((q) => q + ';');
  return queries;
}
