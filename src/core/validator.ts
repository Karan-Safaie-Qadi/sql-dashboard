import type { ValidationResult, ValidationError, SecurityConfig } from '../types';

const STATEMENT_TYPES = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
  'TRUNCATE', 'GRANT', 'REVOKE', 'SHOW', 'DESCRIBE', 'EXPLAIN',
  'USE', 'SET', 'CALL', 'EXEC', 'MERGE', 'REPLACE', 'RENAME',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'LOCK', 'UNLOCK',
  'ANALYZE', 'OPTIMIZE', 'REPAIR', 'BACKUP', 'RESTORE',
] as const;

const DML_STATEMENTS = new Set(['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'MERGE', 'REPLACE']);
const DDL_STATEMENTS = new Set(['CREATE', 'ALTER', 'DROP', 'RENAME', 'TRUNCATE']);
const DCL_STATEMENTS = new Set(['GRANT', 'REVOKE']);
const DANGEROUS_STATEMENTS = new Set(['DROP', 'TRUNCATE', 'GRANT', 'REVOKE', 'ALTER']);

export function detectStatementType(sql: string): string {
  const trimmed = sql.trim().toUpperCase();
  for (const type of STATEMENT_TYPES) {
    if (trimmed.startsWith(type)) return type;
  }
  const words = trimmed.split(/\s+/);
  return words[0] || 'UNKNOWN';
}

export function isReadOnlyStatement(sql: string): boolean {
  const type = detectStatementType(sql);
  return !DML_STATEMENTS.has(type as typeof DML_STATEMENTS extends Set<infer T> ? T : never)
    && !DDL_STATEMENTS.has(type as typeof DDL_STATEMENTS extends Set<infer T> ? T : never)
    && !DCL_STATEMENTS.has(type as typeof DCL_STATEMENTS extends Set<infer T> ? T : never)
    && !DANGEROUS_STATEMENTS.has(type as typeof DANGEROUS_STATEMENTS extends Set<infer T> ? T : never);
}

export function extractTableNames(sql: string): string[] {
  const patterns = [
    /(?:FROM|JOIN|INTO|UPDATE|TABLE|FROM|USING)\s+[`"']?(\w+)[`"']?/gi,
    /(?:INSERT\s+(?:INTO\s+)?|REPLACE\s+(?:INTO\s+)?)[`"']?(\w+)[`"']?/gi,
    /(?:DELETE\s+(?:FROM\s+)?)[`"']?(\w+)[`"']?/gi,
    /(?:ALTER\s+TABLE\s+)[`"']?(\w+)[`"']?/gi,
    /(?:DROP\s+(?:TABLE|VIEW|INDEX|PROCEDURE|FUNCTION)\s+)[`"']?(\w+)[`"']?/gi,
    /(?:CREATE\s+(?:TABLE|VIEW|INDEX|PROCEDURE|FUNCTION)\s+)[`"']?(\w+)[`"']?/gi,
    /(?:TRUNCATE\s+TABLE\s+)[`"']?(\w+)[`"']?/gi,
  ];

  const tables = new Set<string>();
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(sql)) !== null) {
      if (match[1]) tables.add(match[1]);
    }
  }
  return Array.from(tables);
}

export function validateQuery(
  sql: string,
  security?: SecurityConfig
): ValidationResult {
  const errors: ValidationError[] = [];
  let trimmedSql = sql.trim();

  if (!trimmedSql) {
    errors.push({
      code: 'EMPTY_QUERY',
      message: 'Query is empty',
      severity: 'error',
    });
    return { valid: false, errors, normalizedQuery: sql, statementType: 'UNKNOWN', isReadOnly: true, tables: [] };
  }

  if (!trimmedSql.endsWith(';')) {
    trimmedSql = trimmedSql + ';';
  }

  const statementType = detectStatementType(trimmedSql);
  const detectedTables = extractTableNames(trimmedSql);
  const readOnly = isReadOnlyStatement(trimmedSql);

  if (security?.maxQueryLength && trimmedSql.length > security.maxQueryLength) {
    errors.push({
      code: 'QUERY_TOO_LONG',
      message: `Query exceeds maximum length of ${security.maxQueryLength} characters`,
      severity: 'error',
    });
  }

  if (security?.bannedStatements) {
    for (const banned of security.bannedStatements) {
      const bannedUpper = banned.toUpperCase();
      if (trimmedSql.toUpperCase().includes(bannedUpper)) {
        errors.push({
          code: 'BANNED_STATEMENT',
          message: `Statement "${bannedUpper}" is not allowed`,
          severity: 'error',
        });
      }
    }
  }

  if (security?.readOnly === true && !readOnly && statementType !== 'UNKNOWN') {
    errors.push({
      code: 'READ_ONLY_MODE',
      message: 'Database is in read-only mode. Write operations are not allowed.',
      severity: 'error',
    });
  }

  if (security?.requireWhere && ['UPDATE', 'DELETE'].includes(statementType)) {
    if (!/\bWHERE\b/i.test(trimmedSql)) {
      errors.push({
        code: 'MISSING_WHERE',
        message: `${statementType} without WHERE clause is not allowed`,
        severity: 'error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedQuery: trimmedSql,
    statementType,
    isReadOnly: readOnly,
    tables: detectedTables,
  };
}
