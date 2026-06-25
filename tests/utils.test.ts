import { describe, it, expect } from 'vitest';
import { formatSQL, formatResultRow } from '../src/core/formatter';
import { sanitizeComment, sanitizeIdentifier, sanitizeValue, normalizeWhitespace, prepareBatchQueries } from '../src/core/sanitizer';
import { calculatePagination, createPaginatedResult, paginateQuery } from '../src/utils/pagination';

describe('formatSQL', () => {
  it('should uppercase keywords', () => {
    const result = formatSQL('select * from users');
    expect(result).toContain('SELECT');
    expect(result).toContain('FROM');
  });

  it('should not uppercase string literals', () => {
    const result = formatSQL("SELECT 'select from where' as test");
    expect(result).toContain("'select from where'");
  });

  it('should format clauses on new lines', () => {
    const result = formatSQL('SELECT * FROM users WHERE id = 1');
    expect(result).toContain('\nSELECT');
    expect(result).toContain('\nFROM');
    expect(result).toContain('\nWHERE');
  });

  it('should indent non-keyword lines', () => {
    const result = formatSQL('SELECT id, name FROM users');
    const lines = result.split('\n');
    expect(lines.some(l => l.startsWith('  '))).toBe(true);
  });

  it('should handle empty input', () => {
    expect(formatSQL('')).toBe('');
  });

  it('should handle options', () => {
    const result = formatSQL('select * from users', { uppercase: false, indent: '    ' });
    expect(result).toContain('select');
  });
});

describe('formatResultRow', () => {
  it('should format null values', () => {
    const result = formatResultRow({ a: null });
    expect(result.a).toBe('NULL');
  });

  it('should format Buffer values', () => {
    const result = formatResultRow({ a: Buffer.from('test') });
    expect(result.a).toContain('Buffer');
  });

  it('should format Date values', () => {
    const result = formatResultRow({ a: new Date('2024-01-01') });
    expect(result.a).toContain('2024');
  });

  it('should format object values as JSON', () => {
    const result = formatResultRow({ a: { x: 1 } });
    expect(result.a).toContain('{"x":1}');
  });
});

describe('sanitizeComment', () => {
  it('should remove single-line comments', () => {
    expect(sanitizeComment('SELECT 1 -- comment')).toBe('SELECT 1');
  });

  it('should remove multi-line comments', () => {
    expect(sanitizeComment('SELECT /* comment */ 1')).toBe('SELECT  1');
  });

  it('should remove hash comments', () => {
    expect(sanitizeComment('SELECT 1 # comment')).toBe('SELECT 1');
  });
});

describe('sanitizeIdentifier', () => {
  it('should remove special characters', () => {
    expect(sanitizeIdentifier('my-table')).toBe('mytable');
  });

  it('should prefix leading digits', () => {
    expect(sanitizeIdentifier('123abc')).toBe('_123abc');
  });

  it('should allow underscores', () => {
    expect(sanitizeIdentifier('my_table')).toBe('my_table');
  });
});

describe('sanitizeValue', () => {
  it('should handle null', () => {
    expect(sanitizeValue(null)).toBe('NULL');
  });

  it('should handle undefined', () => {
    expect(sanitizeValue(undefined)).toBe('NULL');
  });

  it('should handle numbers', () => {
    expect(sanitizeValue(42)).toBe('42');
  });

  it('should handle booleans', () => {
    expect(sanitizeValue(true)).toBe('1');
    expect(sanitizeValue(false)).toBe('0');
  });

  it('should escape single quotes', () => {
    expect(sanitizeValue("it's")).toBe("'it''s'");
  });
});

describe('normalizeWhitespace', () => {
  it('should collapse multiple spaces', () => {
    expect(normalizeWhitespace('SELECT   *    FROM  users')).toBe('SELECT * FROM users');
  });

  it('should trim spaces around commas and parens', () => {
    expect(normalizeWhitespace('SELECT ( 1 , 2 )')).toBe('SELECT (1,2)');
  });
});

describe('prepareBatchQueries', () => {
  it('should split by semicolon', () => {
    const queries = prepareBatchQueries('SELECT 1; SELECT 2');
    expect(queries).toHaveLength(2);
    expect(queries[0]).toBe('SELECT 1;');
  });

  it('should remove comments before splitting', () => {
    const queries = prepareBatchQueries('SELECT 1; -- comment\nSELECT 2');
    expect(queries).toHaveLength(2);
  });

  it('should handle trailing semicolon', () => {
    const queries = prepareBatchQueries('SELECT 1;');
    expect(queries).toHaveLength(1);
  });
});

describe('pagination', () => {
  it('should calculate pagination with defaults', () => {
    const result = calculatePagination({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('should calculate pagination with custom params', () => {
    const result = calculatePagination({ page: 3, pageSize: 20 });
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(40);
  });

  it('should enforce max page size', () => {
    const result = calculatePagination({ page: 1, pageSize: 9999 });
    expect(result.limit).toBe(1000);
  });

  it('should create paginated result', () => {
    const data = [1, 2, 3];
    const result = createPaginatedResult(data, 100, { page: 2, pageSize: 10 });
    expect(result.data).toBe(data);
    expect(result.total).toBe(100);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(10);
  });

  it('should paginate query with LIMIT/OFFSET', () => {
    const result = paginateQuery('SELECT * FROM users', { page: 2, pageSize: 10 });
    expect(result.query).toContain('LIMIT');
    expect(result.query).toContain('OFFSET');
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(10);
  });

  it('should not add duplicate LIMIT', () => {
    const result = paginateQuery('SELECT * FROM users LIMIT 5', { page: 1, pageSize: 10 });
    expect(result.query).toBe('SELECT * FROM users LIMIT 5');
  });
});
