import { describe, it, expect, vi } from 'vitest';
import { SQLiteDriver } from '../src/drivers/sqlite.driver';
import { MySQLDriver } from '../src/drivers/mysql.driver';
import { PostgresDriver } from '../src/drivers/postgres.driver';
import { DriverType } from '../src/types';

describe('SQLiteDriver', () => {
  it('should create with memory mode', () => {
    const driver = new SQLiteDriver({ mode: 'memory' });
    expect(driver.type).toBe(DriverType.SQLITE);
  });

  it('should connect and disconnect', async () => {
    const driver = new SQLiteDriver({ mode: 'memory' });
    await driver.connect();
    expect(driver.isConnected()).toBe(true);
    await driver.disconnect();
    expect(driver.isConnected()).toBe(false);
  });

  it('should execute SELECT query', async () => {
    const driver = new SQLiteDriver({ mode: 'memory' });
    await driver.connect();
    await driver.executeQuery('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    await driver.executeQuery("INSERT INTO test VALUES (1, 'Alice')");
    const result = await driver.executeQuery('SELECT * FROM test');
    expect(result.status).toBe('success');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Alice');
    await driver.disconnect();
  });

  it('should return insertedId on INSERT', async () => {
    const driver = new SQLiteDriver({ mode: 'memory' });
    await driver.connect();
    await driver.executeQuery('CREATE TABLE test2 (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
    const result = await driver.executeQuery("INSERT INTO test2 (name) VALUES ('Bob')");
    expect((result as any).insertedId).toBe(1);
    await driver.disconnect();
  });

  it('should respect maxRows parameter', async () => {
    const driver = new SQLiteDriver({ mode: 'memory' });
    await driver.connect();
    await driver.executeQuery('CREATE TABLE test3 (id INTEGER PRIMARY KEY, name TEXT)');
    for (let i = 1; i <= 10; i++) {
      await driver.executeQuery(`INSERT INTO test3 VALUES (${i}, 'User${i}')`);
    }
    const result = await driver.executeQuery('SELECT * FROM test3', undefined, 3);
    expect(result.rows).toHaveLength(3);
    await driver.disconnect();
  });

  it('should get schema info', async () => {
    const driver = new SQLiteDriver({ mode: 'memory' });
    await driver.connect();
    await driver.executeQuery('CREATE TABLE schema_test (id INTEGER PRIMARY KEY)');
    await driver.executeQuery('CREATE VIEW test_view AS SELECT * FROM schema_test');
    const schema = await driver.getSchema();
    expect(schema.name).toBe('main');
    expect(schema.tables.length).toBeGreaterThan(0);
    expect(schema.views.length).toBeGreaterThan(0);
    await driver.disconnect();
  });

  it('should get tables list', async () => {
    const driver = new SQLiteDriver({ mode: 'memory' });
    await driver.connect();
    await driver.executeQuery('CREATE TABLE t1 (id INTEGER PRIMARY KEY)');
    await driver.executeQuery('CREATE TABLE t2 (id INTEGER PRIMARY KEY)');
    const tables = await driver.getTables();
    expect(tables.length).toBeGreaterThanOrEqual(2);
    await driver.disconnect();
  });

  it('should get version', async () => {
    const driver = new SQLiteDriver({ mode: 'memory' });
    await driver.connect();
    const version = await driver.getVersion();
    expect(version).toBeTruthy();
    await driver.disconnect();
  });

  it('should get databases list', async () => {
    const driver = new SQLiteDriver({ mode: 'memory' });
    await driver.connect();
    const dbs = await driver.getDatabases();
    expect(dbs).toContain('main');
    await driver.disconnect();
  });

  it('should execute batch with transaction', async () => {
    const driver = new SQLiteDriver({ mode: 'memory' });
    await driver.connect();
    await driver.executeQuery('CREATE TABLE batch_test (id INTEGER PRIMARY KEY, name TEXT)');
    const results = await driver.executeBatch([
      "INSERT INTO batch_test VALUES (1, 'A')",
      "INSERT INTO batch_test VALUES (2, 'B')",
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('success');
    expect(results[1].status).toBe('success');
    const count = await driver.executeQuery('SELECT COUNT(*) as c FROM batch_test');
    expect(count.rows[0].c).toBe(2);
    await driver.disconnect();
  });
});

describe('MySQLDriver (mock)', () => {
  it('should create with defaults', () => {
    const driver = new MySQLDriver({});
    expect(driver.type).toBe(DriverType.MYSQL);
  });

  it('should create with custom config', () => {
    const driver = new MySQLDriver({
      host: 'example.com',
      port: 3307,
      user: 'admin',
      database: 'mydb',
    });
    expect(driver.type).toBe(DriverType.MYSQL);
  });

  it('should accept pool config', () => {
    const driver = new MySQLDriver({}, { max: 20, idleTimeout: 60000 });
    expect(driver.type).toBe(DriverType.MYSQL);
  });
});

describe('PostgresDriver (mock)', () => {
  it('should create with defaults', () => {
    const driver = new PostgresDriver({});
    expect(driver.type).toBe(DriverType.POSTGRES);
  });

  it('should create with custom config', () => {
    const driver = new PostgresDriver({
      host: 'pg.example.com',
      port: 5433,
      user: 'admin',
      database: 'pgdb',
      schema: 'custom',
    });
    expect(driver.type).toBe(DriverType.POSTGRES);
  });

  it('should accept pool config', () => {
    const driver = new PostgresDriver({}, { max: 5, acquireTimeout: 10000 });
    expect(driver.type).toBe(DriverType.POSTGRES);
  });
});

describe('MSSQLDriver (mock)', () => {
  it('should create with defaults', async () => {
    const driver = await createMSSQLDriver();
    expect(driver.type).toBe(DriverType.MSSQL);
  });

  it('should create with custom config', async () => {
    const driver = await createMSSQLDriver({
      server: 'sql.example.com',
      port: 1434,
      user: 'sa',
      database: 'testdb',
    });
    expect(driver.type).toBe(DriverType.MSSQL);
  });
});

async function createMSSQLDriver(config = {}) {
  const { MSSQLDriver } = await import('../src/drivers/mssql.driver');
  return new MSSQLDriver(config);
}
