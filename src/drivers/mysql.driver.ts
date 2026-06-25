import { BaseDriver } from './base.driver';
import { v4 as uuid } from 'uuid';
import type { QueryResult, ColumnInfo, TableInfo, IndexInfo, ForeignKeyInfo, ViewInfo, SchemaInfo, MySQLConfig } from '../types';
import { DriverType } from '../types';
import { QueryTimer } from '../utils/timer';
import { createPool, Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export class MySQLDriver extends BaseDriver {
  public readonly type = DriverType.MYSQL;
  private pool: Pool | null = null;

  private poolConfig?: { min?: number; max?: number; acquireTimeout?: number; idleTimeout?: number; [key: string]: unknown };

  constructor(config: MySQLConfig, poolConfig?: { min?: number; max?: number; acquireTimeout?: number; idleTimeout?: number; [key: string]: unknown }) {
    super();
    this.poolConfig = poolConfig;
    this.config = {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: '',
      charset: 'utf8mb4',
      timezone: '+00:00',
      multipleStatements: false,
      ...config,
    };
  }

  async connect(): Promise<void> {
    try {
      const config = this.config as unknown as MySQLConfig & { connectionLimit: number; waitForConnections: boolean; queueLimit: number };
      const ssl = config.ssl;
      const poolOpts = this.poolConfig || {};
      this.pool = createPool({
        host: config.host || 'localhost',
        port: config.port || 3306,
        user: config.user,
        password: config.password,
        database: config.database,
        charset: config.charset || 'utf8mb4',
        timezone: config.timezone || '+00:00',
        multipleStatements: config.multipleStatements || false,
        ssl: ssl !== undefined ? (typeof ssl === 'object' ? ssl : {} as any) : undefined,
        waitForConnections: true,
        connectionLimit: poolOpts.max || 10,
        queueLimit: 0,
      });
      await this.pool.getConnection();
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to MySQL: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.pool !== null;
  }

  async executeQuery(sql: string, params?: unknown[], maxRows?: number): Promise<QueryResult> {
    this.ensureConnected();
    const timer = new QueryTimer();

    try {
      let querySql = sql;
      if (maxRows && maxRows > 0 && /^\s*SELECT\b/i.test(sql) && !/\bLIMIT\s+\d+/i.test(sql)) {
        querySql = `${sql.replace(/;$/, '')} LIMIT ${maxRows}`;
      }
      const [rows, fields] = await this.pool!.execute<RowDataPacket[] & ResultSetHeader>(querySql, params as any[]);
      const isSelect = Array.isArray(rows);
      const duration = timer.elapsed;

      if (isSelect) {
        const typedRows = rows as RowDataPacket[];
        const columns = fields ? fields.map((f) => f.name) : [];
        return {
          id: uuid(),
          status: 'success',
          rows: typedRows as unknown as Record<string, unknown>[],
          columns,
          rowCount: typedRows.length,
          duration,
          query: sql,
        };
      } else {
        const result = rows as unknown as ResultSetHeader;
        return {
          id: uuid(),
          status: 'success',
          rows: [],
          columns: [],
          rowCount: 0,
          affectedRows: result.affectedRows,
          insertedId: result.insertId,
          duration,
          query: sql,
        };
      }
    } catch (error) {
      return this.createErrorResult(sql, error as Error, timer.elapsed);
    }
  }

  async executeBatch(queries: string[]): Promise<QueryResult[]> {
    const results: QueryResult[] = [];
    const conn = await this.pool!.getConnection();
    try {
      await conn.beginTransaction();
      for (const query of queries) {
        const [rows] = await conn.execute<RowDataPacket[]>(query);
        results.push(this.createResult(query, rows as unknown as Record<string, unknown>[], 0));
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      results.push(this.createErrorResult('Batch', error as Error, 0));
    } finally {
      conn.release();
    }
    return results;
  }

  async getSchema(): Promise<SchemaInfo> {
    const currentDb = await this.getCurrentDatabase();
    return {
      name: currentDb,
      tables: await this.getTables(),
      views: await this.getViews(),
      procedures: await this.getProcedures(),
    };
  }

  private async getCurrentDatabase(): Promise<string> {
    const result = await this.executeQuery('SELECT DATABASE() as db;');
    return (result.rows[0]?.db as string) || 'public';
  }

  async getTables(): Promise<TableInfo[]> {
    const result = await this.executeQuery(
      "SELECT TABLE_NAME, ENGINE, TABLE_ROWS, TABLE_COMMENT, CREATE_TIME, UPDATE_TIME, TABLE_COLLATION " +
      "FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' " +
      "ORDER BY TABLE_NAME;"
    );

    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      const tableName = row.TABLE_NAME as string;
      tables.push({
        name: tableName,
        schema: await this.getCurrentDatabase(),
        type: 'table',
        columns: await this.getColumns(tableName),
        indexes: await this.getIndexes(tableName),
        foreignKeys: await this.getForeignKeys(tableName),
        rowCount: row.TABLE_ROWS as number,
        size: await this.getTableSize(tableName),
        comment: row.TABLE_COMMENT as string,
        createdAt: row.CREATE_TIME ? new Date(row.CREATE_TIME as string) : undefined,
        updatedAt: row.UPDATE_TIME ? new Date(row.UPDATE_TIME as string) : undefined,
        engine: row.ENGINE as string,
        collation: row.TABLE_COLLATION as string,
      });
    }
    return tables;
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    const [columns, indexes, foreignKeys, rowCount] = await Promise.all([
      this.getColumns(tableName),
      this.getIndexes(tableName),
      this.getForeignKeys(tableName),
      this.getTableRowCount(tableName),
    ]);

    return {
      name: tableName,
      schema: await this.getCurrentDatabase(),
      type: 'table',
      columns,
      indexes,
      foreignKeys,
      rowCount,
    };
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    const result = await this.executeQuery(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_KEY, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, COLUMN_COMMENT, COLUMN_TYPE_ENUM
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION;`,
      [tableName]
    );

    return result.rows.map((row) => {
      const extra = (row.EXTRA as string) || '';
      const type = (row.COLUMN_TYPE as string) || '';
      const enumMatch = type.match(/^enum\((.+)\)$/i);
      return {
        name: row.COLUMN_NAME as string,
        type,
        nullable: (row.IS_NULLABLE as string) === 'YES',
        primaryKey: (row.COLUMN_KEY as string) === 'PRI',
        defaultValue: row.COLUMN_DEFAULT as string | null | undefined,
        autoIncrement: extra.includes('auto_increment'),
        maxLength: row.CHARACTER_MAXIMUM_LENGTH as number | undefined,
        precision: row.NUMERIC_PRECISION as number | undefined,
        scale: row.NUMERIC_SCALE as number | undefined,
        comment: row.COLUMN_COMMENT as string | undefined,
        enumValues: enumMatch ? enumMatch[1].split(',').map((v) => v.replace(/'/g, '').trim()) : undefined,
      };
    });
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const result = await this.executeQuery(
      `SHOW INDEX FROM \`${tableName}\`;`
    );

    const indexMap = new Map<string, { columns: string[]; unique: boolean; type: string }>();
    for (const row of result.rows) {
      const name = row.Key_name as string;
      if (!indexMap.has(name)) {
        indexMap.set(name, { columns: [], unique: !row.Non_unique, type: row.Index_type as string });
      }
      indexMap.get(name)!.columns.push(row.Column_name as string);
    }

    return Array.from(indexMap.entries()).map(([name, info]) => ({
      name,
      columns: info.columns,
      unique: info.unique,
      primary: name === 'PRIMARY',
      type: info.unique ? 'unique' : name === 'PRIMARY' ? 'primary' : 'index',
      method: info.type,
    }));
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const db = await this.getCurrentDatabase();
    const result = await this.executeQuery(
      `SELECT COLUMN_NAME, REFERENCED_TABLE_SCHEMA, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME,
              CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL;`,
      [db, tableName]
    );

    return result.rows.map((row) => ({
      name: row.CONSTRAINT_NAME as string,
      column: row.COLUMN_NAME as string,
      referencedSchema: (row.REFERENCED_TABLE_SCHEMA as string) || db,
      referencedTable: row.REFERENCED_TABLE_NAME as string,
      referencedColumn: row.REFERENCED_COLUMN_NAME as string,
      onDelete: row.DELETE_RULE as string,
      onUpdate: row.UPDATE_RULE as string,
    }));
  }

  async getViews(): Promise<ViewInfo[]> {
    const result = await this.executeQuery(
      "SELECT TABLE_NAME, VIEW_DEFINITION FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME;"
    );

    return result.rows.map((row) => ({
      name: row.TABLE_NAME as string,
      schema: '',
      definition: (row.VIEW_DEFINITION as string) || '',
      columns: [],
    }));
  }

  private async getProcedures() {
    const result = await this.executeQuery(
      "SELECT ROUTINE_NAME, ROUTINE_TYPE, DTD_IDENTIFIER FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() ORDER BY ROUTINE_NAME;"
    );
    return result.rows.map((row) => ({
      name: row.ROUTINE_NAME as string,
      schema: '',
      type: (row.ROUTINE_TYPE as string)?.toLowerCase() as 'procedure' | 'function' || 'procedure',
      params: [],
      returnType: row.DTD_IDENTIFIER as string | undefined,
      definition: '',
    }));
  }

  private async getTableSize(tableName: string): Promise<string> {
    const result = await this.executeQuery(
      `SELECT ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS size_mb
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?;`,
      [tableName]
    );
    const size = result.rows[0]?.size_mb;
    return size ? `${size} MB` : '0 MB';
  }

  async getTableRowCount(tableName: string): Promise<number> {
    const result = await this.executeQuery(`SELECT COUNT(*) as count FROM \`${tableName}\`;`);
    return result.rows[0]?.count as number || 0;
  }

  async getVersion(): Promise<string> {
    const result = await this.executeQuery('SELECT VERSION() as version;');
    return result.rows[0]?.version as string || 'unknown';
  }

  async getDatabases(): Promise<string[]> {
    const result = await this.executeQuery('SELECT SCHEMA_NAME as db FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME;');
    return result.rows.map((r) => r.db as string);
  }
}
