import type {
  QueryResult,
  TableInfo,
  ColumnInfo,
  IndexInfo,
  ForeignKeyInfo,
  ViewInfo,
  SchemaInfo,
  DriverType,
} from '../types';
import { v4 as uuid } from 'uuid';

export abstract class BaseDriver {
  public abstract readonly type: DriverType;
  protected connected: boolean = false;
  protected config: Record<string, unknown> = {};

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract executeQuery(sql: string, params?: unknown[]): Promise<QueryResult>;
  abstract executeBatch(queries: string[]): Promise<QueryResult[]>;
  abstract isConnected(): boolean;

  protected createResult(
    query: string,
    rows: Record<string, unknown>[],
    duration: number,
    affectedRows?: number
  ): QueryResult {
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return {
      id: uuid(),
      status: 'success',
      rows,
      columns,
      rowCount: rows.length,
      affectedRows,
      duration,
      query,
    };
  }

  protected createErrorResult(query: string, error: Error, duration: number): QueryResult {
    return {
      id: uuid(),
      status: 'error',
      rows: [],
      columns: [],
      rowCount: 0,
      duration,
      query,
      error: error.message,
    };
  }

  protected ensureConnected(): void {
    if (!this.connected) {
      throw new Error(`Driver ${this.type} is not connected. Call connect() first.`);
    }
  }

  abstract getSchema(): Promise<SchemaInfo>;
  abstract getTables(): Promise<TableInfo[]>;
  abstract getTableInfo(tableName: string): Promise<TableInfo>;
  abstract getColumns(tableName: string): Promise<ColumnInfo[]>;
  abstract getIndexes(tableName: string): Promise<IndexInfo[]>;
  abstract getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]>;
  abstract getViews(): Promise<ViewInfo[]>;
  abstract getTableRowCount(tableName: string): Promise<number>;
  abstract getVersion(): Promise<string>;
  abstract getDatabases(): Promise<string[]>;
}
