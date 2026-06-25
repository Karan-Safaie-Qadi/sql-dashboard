import { BaseDriver } from './base.driver';
import { v4 as uuid } from 'uuid';
import type { QueryResult, ColumnInfo, TableInfo, IndexInfo, ForeignKeyInfo, ViewInfo, SchemaInfo, MSSQLConfig } from '../types';
import { DriverType } from '../types';
import { QueryTimer } from '../utils/timer';

export class MSSQLDriver extends BaseDriver {
  public readonly type = DriverType.MSSQL;
  private connection: any = null;

  constructor(config: MSSQLConfig) {
    super();
    this.config = {
      server: 'localhost',
      port: 1433,
      user: 'sa',
      password: '',
      database: 'master',
      schema: 'dbo',
      encrypt: false,
      trustServerCertificate: true,
      ...config,
    };
  }

  async connect(): Promise<void> {
    const config = this.config as unknown as MSSQLConfig;
    const tedious: any = await import('tedious');
    return new Promise<void>((resolve, reject) => {
      this.connection = new tedious.Connection({
        server: config.server || 'localhost',
        authentication: {
          type: 'default',
          options: {
            userName: config.user,
            password: config.password,
          },
        },
        options: {
          port: config.port || 1433,
          database: config.database,
          encrypt: config.encrypt || false,
          trustServerCertificate: config.trustServerCertificate ?? true,
          rowCollectionOnRequestCompletion: true,
          useColumnNames: false,
        },
      });

      this.connection.on('connect', (err: Error | null) => {
        if (err) {
          reject(new Error(`Failed to connect to MSSQL: ${err.message}`));
        } else {
          this.connected = true;
          resolve();
        }
      });

      this.connection.on('error', (err: Error) => {
        this.connected = false;
        reject(new Error(`MSSQL connection error: ${err.message}`));
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.connection !== null;
  }

  async executeQuery(sql: string, _params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected();
    const timer = new QueryTimer();
    const tedious: any = await import('tedious');

    return new Promise<QueryResult>((resolve) => {
      const rows: Record<string, unknown>[] = [];
      const columns: string[] = [];

      const request = new tedious.Request(sql, (err: any) => {
        if (err) {
          resolve(this.createErrorResult(sql, err, timer.elapsed));
        } else {
          if (rows.length > 0) {
            resolve(this.createResult(sql, rows, timer.elapsed));
          } else {
            const queryResult: QueryResult = {
              id: uuid(),
              status: 'success',
              rows: [],
              columns: [],
              rowCount: 0,
              duration: timer.elapsed,
              query: sql,
            };
            if (/^\s*INSERT\s/i.test(sql.trim()) && columns.length === 0) {
              this.executeQuery('SELECT SCOPE_IDENTITY() as id').then((idResult) => {
                if (idResult.rows.length > 0 && idResult.rows[0]?.id != null) {
                  (queryResult as any).insertedId = idResult.rows[0].id;
                }
                resolve(queryResult);
              }).catch(() => resolve(queryResult));
            } else {
              resolve(queryResult);
            }
          }
        }
      });

      request.on('column', (column: any) => {
        if (column && column.metadata && !columns.includes(column.metadata.colName)) {
          columns.push(column.metadata.colName);
        }
      });

      request.on('row', (rowData: any[]) => {
        const row: Record<string, unknown> = {};
        rowData.forEach((cell: any, index: number) => {
          const colName = columns[index] || `col${index}`;
          row[colName] = cell && typeof cell === 'object' && 'value' in cell
            ? cell.value
            : cell;
        });
        rows.push(row);
      });

      this.connection.execSql(request);
    });
  }

  async executeBatch(queries: string[]): Promise<QueryResult[]> {
    const results: QueryResult[] = [];
    const tedious: any = await import('tedious');

    return new Promise<QueryResult[]>((resolve) => {
      const request = new tedious.Request('BEGIN TRANSACTION;', (err: any) => {
        if (err) {
          results.push(this.createErrorResult('Batch', err, 0));
          return resolve(results);
        }

        let idx = 0;
        const runNext = () => {
          if (idx >= queries.length) {
            const commitReq = new tedious.Request('COMMIT;', (commitErr: any) => {
              if (commitErr) {
                results.push(this.createErrorResult('Batch', commitErr, 0));
              }
              resolve(results);
            });
            this.connection!.execSql(commitReq);
            return;
          }

          this.executeQuery(queries[idx]).then((result) => {
            results.push(result);
            if (result.status === 'error') {
              const rollbackReq = new tedious.Request('ROLLBACK;', () => resolve(results));
              this.connection!.execSql(rollbackReq);
            } else {
              idx++;
              runNext();
            }
          });
        };

        runNext();
      });

      this.connection!.execSql(request);
    });
  }

  async getSchema(): Promise<SchemaInfo> {
    const config = this.config as unknown as MSSQLConfig;
    return {
      name: config.schema || 'dbo',
      tables: await this.getTables(),
      views: await this.getViews(),
      procedures: [],
    };
  }

  async getTables(): Promise<TableInfo[]> {
    const result = await this.executeQuery(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = '${this.config.schema || 'dbo'}' ORDER BY TABLE_NAME;`
    );
    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      const tableName = row.TABLE_NAME as string;
      tables.push({
        name: tableName,
        schema: (this.config.schema as string) || 'dbo',
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
      this.getColumns(tableName), this.getIndexes(tableName),
      this.getForeignKeys(tableName), this.getTableRowCount(tableName),
    ]);
    return {
      name: tableName, schema: (this.config.schema as string) || 'dbo', type: 'table',
      columns, indexes, foreignKeys, rowCount,
    };
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    const schema = (this.config.schema as string) || 'dbo';
    const result = await this.executeQuery(
      `SELECT c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT, c.CHARACTER_MAXIMUM_LENGTH, c.NUMERIC_PRECISION, c.NUMERIC_SCALE, COLUMNPROPERTY(OBJECT_ID('${schema}.${tableName}'), c.COLUMN_NAME, 'IsIdentity') as IS_IDENTITY, COLUMNPROPERTY(OBJECT_ID('${schema}.${tableName}'), c.COLUMN_NAME, 'IsPrimaryKey') as IS_PK FROM INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_SCHEMA = '${schema}' AND c.TABLE_NAME = '${tableName}' ORDER BY c.ORDINAL_POSITION;`
    );
    return result.rows.map((row: any) => ({
      name: row.COLUMN_NAME, type: (row.DATA_TYPE as string).toUpperCase(),
      nullable: row.IS_NULLABLE === 'YES', primaryKey: !!row.IS_PK,
      defaultValue: row.COLUMN_DEFAULT as string | null | undefined,
      autoIncrement: !!row.IS_IDENTITY,
      maxLength: row.CHARACTER_MAXIMUM_LENGTH as number | undefined,
      precision: row.NUMERIC_PRECISION as number | undefined,
      scale: row.NUMERIC_SCALE as number | undefined,
    }));
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const schema = (this.config.schema as string) || 'dbo';
    const result = await this.executeQuery(
      `SELECT i.name, i.is_unique, i.is_primary_key, STUFF((SELECT ',' + col.name FROM sys.index_columns ic JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '') as columns FROM sys.indexes i JOIN sys.tables t ON i.object_id = t.object_id JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = '${schema}' AND t.name = '${tableName}';`
    );
    return result.rows.map((row: any) => {
      const cols = ((row.columns as string) || '').split(',').filter(Boolean);
      return { name: row.name, columns: cols, unique: !!row.is_unique, primary: !!row.is_primary_key, type: row.is_primary_key ? 'primary' : row.is_unique ? 'unique' : 'index' };
    });
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const schema = (this.config.schema as string) || 'dbo';
    const result = await this.executeQuery(
      `SELECT fk.name as constraint_name, COL_NAME(fkc.parent_object_id, fkc.parent_column_id) as column_name, OBJECT_SCHEMA_NAME(fkc.referenced_object_id) as ref_schema, OBJECT_NAME(fkc.referenced_object_id) as ref_table, COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) as ref_column, fk.delete_referential_action_desc, fk.update_referential_action_desc FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id JOIN sys.tables t ON fk.parent_object_id = t.object_id JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = '${schema}' AND t.name = '${tableName}';`
    );
    return result.rows.map((row: any) => ({
      name: row.constraint_name, column: row.column_name,
      referencedSchema: row.ref_schema || schema, referencedTable: row.ref_table,
      referencedColumn: row.ref_column,
      onDelete: ((row.delete_referential_action_desc as string) || 'NO_ACTION').replace(/_/g, ' '),
      onUpdate: ((row.update_referential_action_desc as string) || 'NO_ACTION').replace(/_/g, ' '),
    }));
  }

  async getViews(): Promise<ViewInfo[]> {
    const schema = (this.config.schema as string) || 'dbo';
    const result = await this.executeQuery(
      `SELECT TABLE_NAME, VIEW_DEFINITION FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = '${schema}' ORDER BY TABLE_NAME;`
    );
    return result.rows.map((row: any) => ({ name: row.TABLE_NAME, schema, definition: row.VIEW_DEFINITION || '', columns: [] }));
  }

  async getTableRowCount(tableName: string): Promise<number> {
    const schema = (this.config.schema as string) || 'dbo';
    const result = await this.executeQuery(`SELECT COUNT(*) as count FROM [${schema}].[${tableName}];`);
    return result.rows[0]?.count as number || 0;
  }

  async getVersion(): Promise<string> {
    const result = await this.executeQuery('SELECT @@VERSION as version;');
    return result.rows[0]?.version as string || 'unknown';
  }

  async getDatabases(): Promise<string[]> {
    const result = await this.executeQuery('SELECT name FROM sys.databases ORDER BY name;');
    return result.rows.map((r: any) => r.name as string);
  }

  async explain(sql: string): Promise<QueryResult> {
    return this.executeQuery(`SET SHOWPLAN_XML ON; ${sql.replace(/;$/, '')}; SET SHOWPLAN_XML OFF;`);
  }

  async analyze(sql: string): Promise<QueryResult> {
    return this.executeQuery(`SET STATISTICS PROFILE ON; ${sql.replace(/;$/, '')}; SET STATISTICS PROFILE OFF;`);
  }
}
