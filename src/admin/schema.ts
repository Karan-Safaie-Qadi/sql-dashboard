import type { BaseDriver } from '../drivers';
import type { SchemaInfo, TableInfo, ColumnInfo, IndexInfo, ForeignKeyInfo, ViewInfo, SchemaFilter } from '../types';

export class SchemaBrowser {
  constructor(private driver: BaseDriver) {}

  async getSchema(): Promise<SchemaInfo> {
    return this.driver.getSchema();
  }

  async getTables(filter?: SchemaFilter): Promise<TableInfo[]> {
    const tables = await this.driver.getTables();
    if (filter?.table) {
      return tables.filter((t) => t.name.toLowerCase().includes(filter.table!.toLowerCase()));
    }
    return tables;
  }

  async getTable(name: string): Promise<TableInfo> {
    return this.driver.getTableInfo(name);
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    return this.driver.getColumns(tableName);
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    return this.driver.getIndexes(tableName);
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    return this.driver.getForeignKeys(tableName);
  }

  async getViews(): Promise<ViewInfo[]> {
    return this.driver.getViews();
  }

  async getTableRowCount(tableName: string): Promise<number> {
    return this.driver.getTableRowCount(tableName);
  }

  async searchTables(query: string): Promise<TableInfo[]> {
    const tables = await this.driver.getTables();
    const lower = query.toLowerCase();
    return tables.filter(
      (t) => t.name.toLowerCase().includes(lower)
    );
  }

  async getTableSummary(tableName: string): Promise<{
    name: string;
    columnCount: number;
    indexCount: number;
    foreignKeyCount: number;
    rowCount: number;
    size?: string;
  }> {
    const info = await this.getTable(tableName);
    return {
      name: info.name,
      columnCount: info.columns.length,
      indexCount: info.indexes.length,
      foreignKeyCount: info.foreignKeys.length,
      rowCount: info.rowCount || 0,
      size: info.size,
    };
  }
}
