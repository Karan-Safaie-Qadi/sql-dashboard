export interface SchemaFilter {
  schema?: string;
  table?: string;
  type?: 'table' | 'view' | 'index' | 'procedure';
}

export interface SchemaInfo {
  name: string;
  tables: TableInfo[];
  views: ViewInfo[];
  procedures: ProcedureInfo[];
}

export interface TableInfo {
  name: string;
  schema: string;
  type: 'table' | 'view';
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  foreignKeys: ForeignKeyInfo[];
  rowCount?: number;
  size?: string;
  comment?: string;
  createdAt?: Date;
  updatedAt?: Date;
  engine?: string;
  collation?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string | null;
  autoIncrement?: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  comment?: string;
  enumValues?: string[];
  foreignKey?: {
    table: string;
    column: string;
  };
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
  type: string;
  method?: string;
}

export interface ForeignKeyInfo {
  name: string;
  column: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: string;
  onUpdate: string;
}

export interface ViewInfo {
  name: string;
  schema: string;
  definition: string;
  columns: ColumnInfo[];
}

export interface ProcedureInfo {
  name: string;
  schema: string;
  type: 'procedure' | 'function';
  params: {
    name: string;
    type: string;
    mode: 'IN' | 'OUT' | 'INOUT';
  }[];
  returnType?: string;
  definition: string;
}
