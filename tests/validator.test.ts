import { describe, it, expect } from 'vitest';
import { validateQuery, detectStatementType, isReadOnlyStatement, extractTableNames } from '../src/core/validator';
import { detectInjection, sanitizeComment, prepareBatchQueries } from '../src/core/sanitizer';

describe('Validator', () => {
  it('should detect SELECT statement', () => {
    expect(detectStatementType('SELECT * FROM users')).toBe('SELECT');
  });

  it('should detect INSERT statement', () => {
    expect(detectStatementType('INSERT INTO users VALUES (1)')).toBe('INSERT');
  });

  it('should detect DROP statement', () => {
    expect(detectStatementType('DROP TABLE users')).toBe('DROP');
  });

  it('should identify read-only queries', () => {
    expect(isReadOnlyStatement('SELECT * FROM users')).toBe(true);
    expect(isReadOnlyStatement('SHOW TABLES')).toBe(true);
    expect(isReadOnlyStatement('INSERT INTO users VALUES (1)')).toBe(false);
    expect(isReadOnlyStatement('DROP TABLE users')).toBe(false);
  });

  it('should extract table names', () => {
    const tables = extractTableNames('SELECT * FROM users JOIN orders ON users.id = orders.user_id');
    expect(tables).toContain('users');
    expect(tables).toContain('orders');
  });

  it('should validate a valid query', () => {
    const result = validateQuery('SELECT * FROM users');
    expect(result.valid).toBe(true);
    expect(result.statementType).toBe('SELECT');
  });

  it('should reject empty query', () => {
    const result = validateQuery('');
    expect(result.valid).toBe(false);
  });

  it('should enforce read-only mode', () => {
    const result = validateQuery('DROP TABLE users', { readOnly: true });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('READ_ONLY_MODE');
  });

  it('should enforce banned statements', () => {
    const result = validateQuery('DROP TABLE users', { bannedStatements: ['DROP'] });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('BANNED_STATEMENT');
  });

  it('should enforce max query length', () => {
    const result = validateQuery('SELECT 1', { maxQueryLength: 5 });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('QUERY_TOO_LONG');
  });

  it('should enforce WHERE clause requirement', () => {
    const deleteWithoutWhere = validateQuery('DELETE FROM users', { requireWhere: true });
    expect(deleteWithoutWhere.valid).toBe(false);

    const deleteWithWhere = validateQuery('DELETE FROM users WHERE id = 1', { requireWhere: true });
    expect(deleteWithWhere.valid).toBe(true);
  });
});

describe('Sanitizer', () => {
  it('should detect SQL injection', () => {
    expect(detectInjection("SELECT * FROM users WHERE id = '1' OR '1'='1'")).toBe(true);
    expect(detectInjection("SELECT * FROM users WHERE id = 1")).toBe(false);
  });

  it('should remove comments', () => {
    const result = sanitizeComment('SELECT * FROM users -- this is a comment');
    expect(result).not.toContain('--');
  });

  it('should split batch queries', () => {
    const queries = prepareBatchQueries('SELECT 1; SELECT 2; SELECT 3');
    expect(queries).toHaveLength(3);
  });
});

describe('Export', () => {
  it('should convert results to CSV', async () => {
    const { toCSV } = await import('../src/export/csv');
    const result = {
      id: 'test',
      status: 'success' as const,
      rows: [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }],
      columns: ['name', 'age'],
      rowCount: 2,
      duration: 10,
      query: 'SELECT * FROM users',
    };

    const csv = toCSV(result);
    expect(csv).toContain('"name","age"');
    expect(csv).toContain('Alice');
    expect(csv).toContain('Bob');
  });

  it('should convert results to JSON', async () => {
    const { toJSON } = await import('../src/export/json');
    const result = {
      id: 'test',
      status: 'success' as const,
      rows: [{ name: 'Alice', age: 30 }],
      columns: ['name', 'age'],
      rowCount: 1,
      duration: 10,
      query: 'SELECT * FROM users',
    };

    const json = JSON.parse(toJSON(result));
    expect(json[0].name).toBe('Alice');
  });
});
