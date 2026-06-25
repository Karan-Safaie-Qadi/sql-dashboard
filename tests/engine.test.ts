import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLDashboard } from '../src';
import { DriverType } from '../src/types';

describe('SQLDashboard Engine', () => {
  let db: SQLDashboard;

  beforeAll(async () => {
    db = new SQLDashboard({
      driver: {
        type: DriverType.SQLITE,
        connection: { mode: 'memory' },
      },
      logger: { level: 'silent' },
      autoConnect: true,
    });
    await db.connect();
    await db.query('CREATE TABLE test_users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)');
    await db.query("INSERT INTO test_users VALUES (1, 'Alice', 'alice@example.com')");
    await db.query("INSERT INTO test_users VALUES (2, 'Bob', 'bob@example.com')");
    await db.query("INSERT INTO test_users VALUES (3, 'Charlie', 'charlie@example.com')");
  });

  afterAll(() => {
    db.destroy();
  });

  it('should execute a SELECT query and return results', async () => {
    const result = await db.query('SELECT * FROM test_users');
    expect(result.status).toBe('success');
    expect(result.rows).toHaveLength(3);
    expect(result.columns).toContain('name');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute a query with parameters', async () => {
    const result = await db.query('SELECT * FROM test_users WHERE name = ?', { params: ['Alice'] });
    expect(result.status).toBe('success');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Alice');
  });

  it('should execute INSERT and return affected rows', async () => {
    const result = await db.query("INSERT INTO test_users VALUES (4, 'Dave', 'dave@example.com')");
    expect(result.status).toBe('success');
    const check = await db.query('SELECT COUNT(*) as count FROM test_users');
    expect(check.rows[0].count).toBe(4);
  });

  it('should return error for invalid SQL', async () => {
    const result = await db.query('SELECT * FROM nonexistent_table');
    expect(result.status).toBe('error');
    expect(result.error).toBeTruthy();
  });

  it('should validate queries', () => {
    const valid = db.validate('SELECT * FROM users');
    expect(valid.valid).toBe(true);
    expect(valid.isReadOnly).toBe(true);

    const invalid = db.validate('');
    expect(invalid.valid).toBe(false);
  });

  it('should handle transactions', async () => {
    const result = await db.transaction(async (query) => {
      await query("INSERT INTO test_users VALUES (5, 'Eve', 'eve@example.com')");
      await query("UPDATE test_users SET name = 'Eve Updated' WHERE id = 5");
      return await query('SELECT * FROM test_users WHERE id = 5');
    });
    expect(result.status).toBe('success');
    expect(result.rows[0].name).toBe('Eve Updated');
  });

  it('should rollback on transaction error', async () => {
    const beforeCount = (await db.query('SELECT COUNT(*) as count FROM test_users')).rows[0].count;

    try {
      await db.transaction(async (query) => {
        await query("INSERT INTO test_users VALUES (6, 'Frank', 'frank@example.com')");
        throw new Error('Rollback test');
      });
    } catch { }

    const afterCount = (await db.query('SELECT COUNT(*) as count FROM test_users')).rows[0].count;
    expect(afterCount).toBe(beforeCount);
  });

  it('should provide database status', async () => {
    const status = await db.status();
    expect(status.connected).toBe(true);
    expect(status.driver).toBe('sqlite');
    expect(status.version).toBe('1.2.0');
  });

  it('should get database version', async () => {
    const version = await db.getDriverVersion();
    expect(version).toBeTruthy();
  });

  it('should get databases list', async () => {
    const databases = await db.getDatabases();
    expect(databases).toContain('main');
  });
});

describe('SQLDashboard Security', () => {
  it('should enforce read-only mode', async () => {
    const db = new SQLDashboard({
      driver: { type: DriverType.SQLITE, connection: { mode: 'memory' } },
      security: { readOnly: true },
      logger: { level: 'silent' },
    });
    await db.connect();

    const selectResult = await db.query('SELECT 1 as test');
    expect(selectResult.status).toBe('success');

    const insertResult = await db.query("CREATE TABLE test (id INTEGER)");
    expect(insertResult.status).toBe('error');
    expect(insertResult.error).toContain('read-only');

    db.destroy();
  });

  it('should enforce query length limits', async () => {
    const db = new SQLDashboard({
      driver: { type: DriverType.SQLITE, connection: { mode: 'memory' } },
      security: { maxQueryLength: 3 },
      logger: { level: 'silent' },
    });

    const result = await db.query('SELECT 1');
    expect(result.status).toBe('error');

    db.destroy();
  });

  it('should detect SQL injection attempts', async () => {
    const db = new SQLDashboard({
      driver: { type: DriverType.SQLITE, connection: { mode: 'memory' } },
      logger: { level: 'silent' },
    });
    await db.connect();

    const result = await db.query("SELECT * FROM users WHERE id = 1 OR '1'='1'");
    expect(result.status).toBe('error');
    expect(result.error).toContain('injection');

    db.destroy();
  });
});

describe('SQLDashboard Schema', () => {
  let db: SQLDashboard;

  beforeAll(async () => {
    db = new SQLDashboard({
      driver: { type: DriverType.SQLITE, connection: { mode: 'memory' } },
      logger: { level: 'silent' },
    });
    await db.connect();
    await db.query('CREATE TABLE schema_test (id INTEGER PRIMARY KEY, value TEXT)');
    await db.query('CREATE INDEX idx_value ON schema_test(value)');
    await db.query('CREATE VIEW test_view AS SELECT * FROM schema_test');
  });

  afterAll(() => db.destroy());

  it('should get schema info', async () => {
    const schema = await db.schema.getSchema();
    expect(schema.name).toBe('main');
    expect(schema.tables.length).toBeGreaterThan(0);
  });

  it('should get tables list', async () => {
    const tables = await db.schema.getTables();
    expect(tables.some((t) => t.name === 'schema_test')).toBe(true);
  });

  it('should get table columns', async () => {
    const columns = await db.schema.getColumns('schema_test');
    expect(columns).toHaveLength(2);
    expect(columns[0].name).toBe('id');
    expect(columns[0].primaryKey).toBe(true);
  });

  it('should get table indexes', async () => {
    const indexes = await db.schema.getIndexes('schema_test');
    expect(indexes.length).toBeGreaterThan(0);
  });

  it('should get views', async () => {
    const views = await db.schema.getViews();
    expect(views.some((v) => v.name === 'test_view')).toBe(true);
  });

  it('should get table row count', async () => {
    const count = await db.schema.getTableRowCount('schema_test');
    expect(count).toBe(0);
  });

  it('should search tables', async () => {
    const results = await db.schema.searchTables('schema');
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('SQLDashboard Query History', () => {
  let db: SQLDashboard;

  beforeAll(async () => {
    db = new SQLDashboard({
      driver: { type: DriverType.SQLITE, connection: { mode: 'memory' } },
      logger: { level: 'silent' },
    });
    await db.connect();
    await db.query('CREATE TABLE history_test (id INTEGER PRIMARY KEY, name TEXT)');
    await db.query("INSERT INTO history_test VALUES (1, 'Test')");
  });

  afterAll(() => db.destroy());

  it('should record query history', async () => {
    await db.query('SELECT * FROM history_test');
    const history = db.history.list();
    expect(history.data.length).toBeGreaterThan(0);
  });

  it('should provide history stats', () => {
    const stats = db.history.getStats();
    expect(stats.totalQueries).toBeGreaterThan(0);
    expect(stats.successfulQueries).toBeGreaterThan(0);
  });

  it('should search history', async () => {
    await db.query('SELECT * FROM history_test WHERE name = ?', { params: ['Test'] });
    const results = db.history.list({ search: 'history_test' });
    expect(results.data.length).toBeGreaterThan(0);
  });

  it('should clear history', () => {
    db.history.clear();
    const stats = db.history.getStats();
    expect(stats.totalQueries).toBe(0);
  });
});
