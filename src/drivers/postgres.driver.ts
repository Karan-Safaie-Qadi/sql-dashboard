import { BaseDriver } from './base.driver';
import { v4 as uuid } from 'uuid';
import type { QueryResult, ColumnInfo, TableInfo, IndexInfo, ForeignKeyInfo, ViewInfo, SchemaInfo, PostgreSQLConfig } from '../types';
import { DriverType } from '../types';
import { QueryTimer } from '../utils/timer';
import { Pool } from 'pg';

export class PostgresDriver extends BaseDriver {
  public readonly type = DriverType.POSTGRES;
  private pool: Pool | null = null;
  private currentSchema: string = 'public';

  private poolConfig?: { min?: number; max?: number; acquireTimeout?: number; idleTimeout?: number; [key: string]: unknown };

  constructor(config: PostgreSQLConfig, poolConfig?: { min?: number; max?: number; acquireTimeout?: number; idleTimeout?: number; [key: string]: unknown }) {
    super();
    this.poolConfig = poolConfig;
    this.currentSchema = config.schema || 'public';
    this.config = {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: '',
      database: 'postgres',
      ...config,
    };
  }

  async connect(): Promise<void> {
    try {
      const config = this.config as unknown as PostgreSQLConfig;
      const ssl = config.ssl;
      const poolOpts = this.poolConfig || {};
      this.pool = new Pool({
        host: config.host || 'localhost',
        port: config.port || 5432,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: ssl !== undefined ? ssl : undefined,
        application_name: config.applicationName || 'sql-dashboard',
        max: poolOpts.max || 10,
        idleTimeoutMillis: poolOpts.idleTimeout || 30000,
        connectionTimeoutMillis: poolOpts.acquireTimeout || 5000,
      });
      await this.pool.query('SELECT 1');
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to PostgreSQL: ${(error as Error).message}`);
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
      let normalizedSql = sql.trim().replace(/;$/, '');
      const isSelect = /^\s*(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN|ANALYZE)/i.test(normalizedSql);
      if (isSelect && maxRows && maxRows > 0 && !/\bLIMIT\s+\d+/i.test(normalizedSql)) {
        normalizedSql = `${normalizedSql} LIMIT ${maxRows}`;
      }
      const result = await this.pool!.query(normalizedSql, params as any[]);

      if (isSelect || result.rows.length > 0) {
        return {
          id: uuid(),
          status: 'success',
          rows: result.rows as Record<string, unknown>[],
          columns: result.fields.map((f) => f.name),
          rowCount: result.rows.length,
          duration: timer.elapsed,
          query: sql,
        };
      } else {
        const queryResult: QueryResult = {
          id: uuid(),
          status: 'success',
          rows: [],
          columns: [],
          rowCount: 0,
          affectedRows: result.rowCount || 0,
          duration: timer.elapsed,
          query: sql,
        };
        if (/^\s*INSERT\s/i.test(normalizedSql) && (result.rowCount || 0) > 0) {
          (queryResult as any).insertedId = result.rows[0]?.id ?? result.rows[0]?.ID;
        }
        return queryResult;
      }
    } catch (error) {
      return this.createErrorResult(sql, error as Error, timer.elapsed);
    }
  }

  async executeBatch(queries: string[]): Promise<QueryResult[]> {
    const results: QueryResult[] = [];
    const client = await this.pool!.connect();
    try {
      await client.query('BEGIN');
      for (const query of queries) {
        const result = await this.executeQuery(query);
        results.push(result);
        if (result.status === 'error') {
          await client.query('ROLLBACK');
          return results;
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      results.push(this.createErrorResult('Batch', error as Error, 0));
    } finally {
      client.release();
    }
    return results;
  }

  async getSchema(): Promise<SchemaInfo> {
    return {
      name: this.currentSchema,
      tables: await this.getTables(),
      views: await this.getViews(),
      procedures: await this.getProcedures(),
    };
  }

  async getTables(): Promise<TableInfo[]> {
    const result = await this.executeQuery(
      `SELECT tablename FROM pg_catalog.pg_tables
       WHERE schemaname = $1
       ORDER BY tablename;`,
      [this.currentSchema]
    );

    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      const tableName = row.tablename as string;
      tables.push({
        name: tableName,
        schema: this.currentSchema,
        type: 'table',
        columns: await this.getColumns(tableName),
        indexes: await this.getIndexes(tableName),
        foreignKeys: await this.getForeignKeys(tableName),
        rowCount: await this.getTableRowCount(tableName),
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
      schema: this.currentSchema,
      type: 'table',
      columns,
      indexes,
      foreignKeys,
      rowCount,
    };
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    const result = await this.executeQuery(
      `SELECT
        c.column_name, c.data_type, c.is_nullable, c.column_default,
        c.character_maximum_length, c.numeric_precision, c.numeric_scale,
        tc.constraint_type
       FROM information_schema.columns c
       LEFT JOIN information_schema.key_column_usage kcu
         ON c.column_name = kcu.column_name AND c.table_name = kcu.table_name AND c.table_schema = kcu.table_schema
       LEFT JOIN information_schema.table_constraints tc
         ON kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position;`,
      [this.currentSchema, tableName]
    );

    return result.rows.map((row) => {
      const defaultVal = row.column_default as string | null;
      const isSerial = defaultVal ? defaultVal.startsWith('nextval') : false;
      return {
        name: row.column_name as string,
        type: this.mapPostgresType(row.data_type as string),
        nullable: row.is_nullable === 'YES',
        primaryKey: row.constraint_type === 'PRIMARY KEY',
        defaultValue: defaultVal,
        autoIncrement: isSerial || row.data_type === 'serial' || row.data_type === 'bigserial',
        maxLength: row.character_maximum_length as number | undefined,
        precision: row.numeric_precision as number | undefined,
        scale: row.numeric_scale as number | undefined,
      };
    });
  }

  private mapPostgresType(type: string): string {
    const map: Record<string, string> = {
      'integer': 'INTEGER',
      'bigint': 'BIGINT',
      'smallint': 'SMALLINT',
      'character varying': 'VARCHAR',
      'character': 'CHAR',
      'text': 'TEXT',
      'boolean': 'BOOLEAN',
      'timestamp without time zone': 'TIMESTAMP',
      'timestamp with time zone': 'TIMESTAMPTZ',
      'date': 'DATE',
      'time without time zone': 'TIME',
      'time with time zone': 'TIMETZ',
      'double precision': 'DOUBLE PRECISION',
      'real': 'REAL',
      'numeric': 'NUMERIC',
      'uuid': 'UUID',
      'json': 'JSON',
      'jsonb': 'JSONB',
      'bytea': 'BYTEA',
    };
    return map[type] || type.toUpperCase();
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const result = await this.executeQuery(
      `SELECT
        i.indexname, i.indexdef,
        am.amname as index_method,
        pi.indisunique, pi.indisprimary
       FROM pg_indexes i
       JOIN pg_index pi ON pi.indexrelid = (SELECT oid FROM pg_class WHERE relname = i.indexname)
       JOIN pg_am am ON am.oid = (SELECT relam FROM pg_class WHERE relname = i.indexname)
       WHERE i.schemaname = $1 AND i.tablename = $2;`,
      [this.currentSchema, tableName]
    );

    return result.rows.map((row) => {
      const def = row.indexdef as string;
      const colMatch = def.match(/\((.+?)\)/);
      const columns = colMatch ? colMatch[1].split(',').map((c) => c.trim()) : [];
      return {
        name: row.indexname as string,
        columns,
        unique: !!row.indisunique,
        primary: !!row.indisprimary,
        type: row.indisprimary ? 'primary' : row.indisunique ? 'unique' : 'index',
        method: row.index_method as string,
      };
    });
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const result = await this.executeQuery(
      `SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema AS referenced_schema,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column,
        rc.delete_rule,
        rc.update_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
       JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
       WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY';`,
      [this.currentSchema, tableName]
    );

    return result.rows.map((row) => ({
      name: row.constraint_name as string,
      column: row.column_name as string,
      referencedSchema: (row.referenced_schema as string) || this.currentSchema,
      referencedTable: row.referenced_table as string,
      referencedColumn: row.referenced_column as string,
      onDelete: (row.delete_rule as string) || 'NO ACTION',
      onUpdate: (row.update_rule as string) || 'NO ACTION',
    }));
  }

  async getViews(): Promise<ViewInfo[]> {
    const result = await this.executeQuery(
      `SELECT table_name, view_definition
       FROM information_schema.views
       WHERE table_schema = $1
       ORDER BY table_name;`,
      [this.currentSchema]
    );

    return result.rows.map((row) => ({
      name: row.table_name as string,
      schema: this.currentSchema,
      definition: (row.view_definition as string) || '',
      columns: [],
    }));
  }

  private async getProcedures() {
    const result = await this.executeQuery(
      `SELECT routine_name, routine_type
       FROM information_schema.routines
       WHERE routine_schema = $1 AND routine_type IN ('PROCEDURE', 'FUNCTION')
       ORDER BY routine_name;`,
      [this.currentSchema]
    );
    return result.rows.map((row) => ({
      name: row.routine_name as string,
      schema: this.currentSchema,
      type: (row.routine_type as string)?.toLowerCase() as 'procedure' | 'function' || 'procedure',
      params: [],
      definition: '',
    }));
  }

  async getTableRowCount(tableName: string): Promise<number> {
    const result = await this.executeQuery(
      `SELECT COUNT(*)::int as count FROM "${this.currentSchema}"."${tableName}";`
    );
    return result.rows[0]?.count as number || 0;
  }

  async getVersion(): Promise<string> {
    const result = await this.executeQuery('SELECT version() as version;');
    return result.rows[0]?.version as string || 'unknown';
  }

  async getDatabases(): Promise<string[]> {
    const result = await this.executeQuery(
      'SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;'
    );
    return result.rows.map((r) => r.datname as string);
  }
}
