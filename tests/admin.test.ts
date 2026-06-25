import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLDashboard } from '../src';
import { DriverType } from '../src/types';

describe('SchemaBrowser', () => {
  let db: SQLDashboard;

  beforeAll(async () => {
    db = new SQLDashboard({
      driver: { type: DriverType.SQLITE, connection: { mode: 'memory' } },
      logger: { level: 'silent' },
    });
    await db.connect();
    await db.query('CREATE TABLE admin_test (id INTEGER PRIMARY KEY, name TEXT, email TEXT)');
    await db.query('CREATE INDEX idx_admin_name ON admin_test(name)');
    await db.query('CREATE VIEW admin_view AS SELECT id, name FROM admin_test');
  });

  afterAll(() => db.destroy());

  it('should get full schema', async () => {
    const schema = await db.schema.getSchema();
    expect(schema.name).toBe('main');
    expect(schema.tables.length).toBeGreaterThan(0);
    expect(schema.views.length).toBeGreaterThan(0);
  });

  it('should get tables with filter', async () => {
    const tables = await db.schema.getTables({ table: 'admin' });
    expect(tables.length).toBeGreaterThan(0);
    expect(tables[0].name).toContain('admin');
  });

  it('should return empty for non-matching filter', async () => {
    const tables = await db.schema.getTables({ table: 'nonexistent_xyz' });
    expect(tables).toHaveLength(0);
  });

  it('should get table info', async () => {
    const info = await db.schema.getTable('admin_test');
    expect(info.name).toBe('admin_test');
    expect(info.columns.length).toBe(3);
  });

  it('should get columns', async () => {
    const columns = await db.schema.getColumns('admin_test');
    expect(columns).toHaveLength(3);
    const idCol = columns.find(c => c.name === 'id');
    expect(idCol?.primaryKey).toBe(true);
  });

  it('should get indexes', async () => {
    const indexes = await db.schema.getIndexes('admin_test');
    expect(indexes.length).toBeGreaterThan(0);
    expect(indexes.some(i => i.name === 'idx_admin_name')).toBe(true);
  });

  it('should get foreign keys (empty)', async () => {
    const fks = await db.schema.getForeignKeys('admin_test');
    expect(fks).toHaveLength(0);
  });

  it('should get views', async () => {
    const views = await db.schema.getViews();
    expect(views.some(v => v.name === 'admin_view')).toBe(true);
  });

  it('should get table row count', async () => {
    await db.query("INSERT INTO admin_test VALUES (1, 'Test', 'test@test.com')");
    const count = await db.schema.getTableRowCount('admin_test');
    expect(count).toBe(1);
  });

  it('should search tables', async () => {
    const results = await db.schema.searchTables('admin');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should get table summary', async () => {
    const summary = await db.schema.getTableSummary('admin_test');
    expect(summary.name).toBe('admin_test');
    expect(summary.columnCount).toBe(3);
    expect(summary.indexCount).toBeGreaterThan(0);
    expect(summary.rowCount).toBe(1);
  });
});

describe('QueryHistory', () => {
  let db: SQLDashboard;

  beforeAll(async () => {
    db = new SQLDashboard({
      driver: { type: DriverType.SQLITE, connection: { mode: 'memory' } },
      logger: { level: 'silent' },
    });
    await db.connect();
    await db.query('CREATE TABLE hist_data (id INTEGER PRIMARY KEY, val TEXT)');
    await db.query("INSERT INTO hist_data VALUES (1, 'x')");
  });

  afterAll(() => db.destroy());

  it('should record history on query', async () => {
    await db.query('SELECT * FROM hist_data');
    const history = db.history.list();
    expect(history.data.length).toBeGreaterThan(0);
  });

  it('should filter by status', async () => {
    const success = db.history.list({ status: 'success' });
    expect(success.data.length).toBeGreaterThan(0);

    const error = db.history.list({ status: 'error' });
    expect(error.data.length).toBe(0);
  });

  it('should filter by database', async () => {
    const all = db.history.list();
    if (all.data.length === 0) {
      await db.query('SELECT 1 as test');
    }
    const filtered = db.history.list({ database: 'sqlite' });
    expect(filtered.data.length).toBeGreaterThan(0);

    const noMatch = db.history.list({ database: 'nonexistent' });
    expect(noMatch.data.length).toBe(0);
  });

  it('should search by query text', async () => {
    const results = db.history.list({ search: 'hist_data' });
    expect(results.data.length).toBeGreaterThan(0);

    const noResults = db.history.list({ search: 'zzz_nonexistent_zzz' });
    expect(noResults.data.length).toBe(0);
  });

  it('should paginate results', async () => {
    const page1 = db.history.list({ page: 1, pageSize: 2 });
    expect(page1.data.length).toBeLessThanOrEqual(2);
    expect(page1.page).toBe(1);
  });

  it('should return stats', () => {
    const stats = db.history.getStats();
    expect(stats.totalQueries).toBeGreaterThan(0);
    expect(stats.successfulQueries).toBeGreaterThan(0);
    expect(typeof stats.avgDuration).toBe('number');
  });

  it('should get recent entries', () => {
    const recent = db.history.getRecent(5);
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThanOrEqual(5);
  });

  it('should clear history', () => {
    db.history.clear();
    const stats = db.history.getStats();
    expect(stats.totalQueries).toBe(0);
  });

  it('should remove specific entry', async () => {
    await db.query('SELECT 1');
    const before = db.history.list();
    const id = before.data[0].id;
    db.history.remove(id);
    const after = db.history.list({ search: 'SELECT 1' });
    const stillHas = after.data.some(e => e.id === id);
    expect(stillHas).toBe(false);
  });
});
