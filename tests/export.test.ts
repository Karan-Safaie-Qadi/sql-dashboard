import { describe, it, expect } from 'vitest';
import { toCSV } from '../src/export/csv';
import { toJSON, toJSONLines, toJSONArray } from '../src/export/json';

describe('CSV Export', () => {
  const result = {
    id: 'test',
    status: 'success' as const,
    rows: [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }],
    columns: ['name', 'age'],
    rowCount: 2,
    duration: 10,
    query: 'SELECT * FROM users',
  };

  it('should produce CSV with header', () => {
    const csv = toCSV(result);
    expect(csv).toContain('"name","age"');
  });

  it('should include all rows in CSV', () => {
    const csv = toCSV(result);
    expect(csv).toContain('Alice');
    expect(csv).toContain('Bob');
  });

  it('should handle empty result', () => {
    const empty = toCSV({ ...result, rows: [], columns: [], rowCount: 0 });
    expect(typeof empty).toBe('string');
  });

  it('should handle null values', () => {
    const nullResult = { ...result, rows: [{ name: null, age: undefined }] };
    const csv = toCSV(nullResult);
    expect(csv).toBeTruthy();
  });
});

describe('JSON Export', () => {
  const result = {
    id: 'test',
    status: 'success' as const,
    rows: [{ name: 'Alice', age: 30 }],
    columns: ['name', 'age'],
    rowCount: 1,
    duration: 10,
    query: 'SELECT * FROM users',
  };

  it('should produce valid JSON array', () => {
    const json = JSON.parse(toJSON(result));
    expect(Array.isArray(json)).toBe(true);
    expect(json[0].name).toBe('Alice');
  });

  it('should format JSON with indentation', () => {
    const json = toJSON(result);
    expect(json).toContain('\n');
  });

  it('should produce JSON Lines format', () => {
    const lines = toJSONLines(result).trim().split('\n');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.name).toBe('Alice');
  });

  it('should produce JSON Array format', () => {
    const arr = toJSONArray(result);
    const parsed = JSON.parse(arr);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('should handle empty result set', () => {
    const empty = toJSON({ ...result, rows: [], columns: [], rowCount: 0 });
    expect(empty).toContain('[]');
  });
});
