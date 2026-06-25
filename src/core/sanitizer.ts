const SQL_INJECTION_PATTERNS = [
  /;\s*DROP\s+/i,
  /;\s*DELETE\s+/i,
  /;\s*UPDATE\s+/i,
  /;\s*INSERT\s+/i,
  /;\s*EXEC(?:UTE)?\s+/i,
  /\bINTO\s+OUTFILE\b/i,
  /\bINTO\s+DUMPFILE\b/i,
  /\bLOAD_FILE\s*\(/i,
  /\bpg_sleep\s*\(/i,
  /\bWAITFOR\s+DELAY\b/i,
  /\bBENCHMARK\s*\(/i,
  /\bSLEEP\s*\(/i,
];

const INJECTION_STRING_PATTERNS = [
  /'.*OR.*'='/i,
  /'.*AND.*'='/i,
  /OR\s+'.*'='.*'/i,
  /AND\s+'.*'='.*'/i,
  /\bUNION\s+ALL\s+SELECT\b/i,
  /\bUNION\s+SELECT\b/i,
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

  if (SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(noComments))) {
    return true;
  }

  const strings: string[] = [];
  const noStrings = noComments.replace(STRING_LITERALS, (m) => {
    strings.push(m);
    return '';
  });

  if (noStrings !== noComments) {
    const original = noComments;
    if (INJECTION_STRING_PATTERNS.some((pattern) => pattern.test(original))) {
      return true;
    }
  }

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(noStrings)) {
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
