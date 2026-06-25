import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { BaseDriver } from './base.driver';
import type { QueryResult, ColumnInfo, TableInfo, IndexInfo, ForeignKeyInfo, ViewInfo, SchemaInfo, SQLiteConfig } from '../types';
import { DriverType } from '../types';
import { QueryTimer } from '../utils/timer';

export class SQLiteDriver extends BaseDriver {
  public readonly type = DriverType.SQLITE;
  private db: SqlJsDatabase | null = null;
  private sqlJs: SqlJsStatic | null = null;
  private dbPath: string;
  private memoryMode: boolean;

  constructor(config: SQLiteConfig) {
    super();
    this.memoryMode = config.mode === 'memory' || !config.path;
    this.dbPath = config.path || ':memory:';
    this.config = { ...config };
  }

  async connect(): Promise<void> {
    try {
      this.sqlJs = await initSqlJs();
      if (this.memoryMode) {
        this.db = new this.sqlJs.Database();
      } else {
        const fullPath = path.resolve(this.dbPath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        if (fs.existsSync(fullPath)) {
          const buffer = fs.readFileSync(fullPath);
          this.db = new this.sqlJs.Database(buffer);
        } else {
          this.db = new this.sqlJs.Database();
          this.saveToFile();
        }
      }
      this.db.run('PRAGMA journal_mode=WAL;');
      this.db.run('PRAGMA foreign_keys=ON;');
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to SQLite: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      if (!this.memoryMode && this.dbPath !== ':memory:') {
        this.saveToFile();
      }
      this.db.close();
      this.db = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.db !== null;
  }

  private saveToFile(): void {
    if (this.db && !this.memoryMode) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(path.resolve(this.dbPath), buffer);
    }
  }

  async executeQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected();
    const timer = new QueryTimer();

    try {
      const normalizedSql = sql.trim().replace(/;$/, '');
      const isSelect = /^\s*(SELECT|PRAGMA|SHOW|DESCRIBE|EXPLAIN)/i.test(normalizedSql);

      if (isSelect) {
        const stmt = this.db!.prepare(normalizedSql);
        const rows: Record<string, unknown>[] = [];
        const columns: string[] = [];
        columns.push(...stmt.getColumnNames());

        if (params && params.length > 0) {
          stmt.bind(params as any);
        }

        while (stmt.step()) {
          const row = stmt.getAsObject();
          rows.push(row as Record<string, unknown>);
        }
        stmt.free();

        return this.createResult(sql, rows, timer.elapsed);
      } else {
        const isInsert = /^\s*INSERT\s/i.test(normalizedSql);
        this.db!.run(normalizedSql, params as (number | string | Uint8Array)[]);
        const affectedRows = this.db!.getRowsModified();
        const result = this.createResult(sql, [], timer.elapsed, affectedRows);
        if (isInsert && affectedRows > 0) {
          const idResult = this.db!.exec('SELECT last_insert_rowid() as id;');
          const idRows = idResult[0]?.values?.[0];
          if (idRows) {
            (result as any).insertedId = idRows[0];
          }
        }
        return result;
      }
    } catch (error) {
      return this.createErrorResult(sql, error as Error, timer.elapsed);
    }
  }

  async executeBatch(queries: string[]): Promise<QueryResult[]> {
    this.ensureConnected();
    const results: QueryResult[] = [];

    try {
      this.db!.run('BEGIN TRANSACTION;');
      for (const query of queries) {
        const result = await this.executeQuery(query);
        results.push(result);
        if (result.status === 'error') {
          this.db!.run('ROLLBACK;');
          return results;
        }
      }
      this.db!.run('COMMIT;');
    } catch (error) {
      this.db!.run('ROLLBACK;');
      results.push(this.createErrorResult('Batch', error as Error, 0));
    }

    return results;
  }

  async getSchema(): Promise<SchemaInfo> {
    this.ensureConnected();
    return {
      name: 'main',
      tables: await this.getTables(),
      views: await this.getViews(),
      procedures: [],
    };
  }

  async getTables(): Promise<TableInfo[]> {
    const result = await this.executeQuery(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );

    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      const tableName = row.name as string;
      const columns = await this.getColumns(tableName);
      const indexes = await this.getIndexes(tableName);
      const foreignKeys = await this.getForeignKeys(tableName);
      const rowCount = await this.getTableRowCount(tableName);

      tables.push({
        name: tableName,
        schema: 'main',
        type: 'table',
        columns,
        indexes,
        foreignKeys,
        rowCount,
      });
    }

    return tables;
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    const columns = await this.getColumns(tableName);
    const indexes = await this.getIndexes(tableName);
    const foreignKeys = await this.getForeignKeys(tableName);
    const rowCount = await this.getTableRowCount(tableName);

    return {
      name: tableName,
      schema: 'main',
      type: 'table',
      columns,
      indexes,
      foreignKeys,
      rowCount,
    };
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    const result = await this.executeQuery(`PRAGMA table_info("${tableName}");`);
    return result.rows.map((row) => ({
      name: row.name as string,
      type: (row.type as string) || 'TEXT',
      nullable: !(row.notnull as number),
      primaryKey: (row.pk as number) === 1,
      defaultValue: row.dflt_value as string | null | undefined,
    }));
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const result = await this.executeQuery(`PRAGMA index_list("${tableName}");`);
    const indexes: IndexInfo[] = [];

    for (const row of result.rows) {
      const indexName = row.name as string;
      const unique = !!row.unique;
      const primary = indexName.startsWith('sqlite_autoindex');

      const indexInfo = await this.executeQuery(`PRAGMA index_info("${indexName}");`);
      const columns = indexInfo.rows.map((r) => r.name as string);

      indexes.push({
        name: indexName,
        columns,
        unique,
        primary,
        type: primary ? 'primary' : unique ? 'unique' : 'index',
      });
    }

    return indexes;
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const result = await this.executeQuery(`PRAGMA foreign_key_list("${tableName}");`);
    return result.rows.map((row) => ({
      name: `fk_${tableName}_${row.from as string}`,
      column: row.from as string,
      referencedSchema: 'main',
      referencedTable: row.table as string,
      referencedColumn: row.to as string,
      onDelete: (row.on_delete as string) || 'NO ACTION',
      onUpdate: (row.on_update as string) || 'NO ACTION',
    }));
  }

  async getViews(): Promise<ViewInfo[]> {
    const result = await this.executeQuery(
      "SELECT name, sql FROM sqlite_master WHERE type='view' ORDER BY name;"
    );

    return result.rows.map((row) => ({
      name: row.name as string,
      schema: 'main',
      definition: (row.sql as string) || '',
      columns: [],
    }));
  }

  async getTableRowCount(tableName: string): Promise<number> {
    const result = await this.executeQuery(
      `SELECT COUNT(*) as count FROM "${tableName}";`
    );
    return result.rows[0]?.count as number || 0;
  }

  async getVersion(): Promise<string> {
    const result = await this.executeQuery('SELECT sqlite_version() as version;');
    return result.rows[0]?.version as string || 'unknown';
  }

  async getDatabases(): Promise<string[]> {
    return ['main'];
  }
}
