export enum DriverType {
  SQLITE = 'sqlite',
  MYSQL = 'mysql',
  POSTGRES = 'postgres',
  MSSQL = 'mssql',
}

export interface PoolConfig {
  min?: number;
  max?: number;
  acquireTimeout?: number;
  idleTimeout?: number;
}

export interface MySQLConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  charset?: string;
  timezone?: string;
  multipleStatements?: boolean;
  ssl?: boolean | object;
}

export interface PostgreSQLConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  schema?: string;
  ssl?: boolean | object;
  applicationName?: string;
}

export interface MSSQLConfig {
  server?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  schema?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  options?: Record<string, unknown>;
}

export interface SQLiteConfig {
  path?: string;
  mode?: 'memory' | 'file';
  readOnly?: boolean;
}

export type DriverConfig =
  | { type: DriverType.SQLITE; connection: SQLiteConfig; pool?: PoolConfig }
  | { type: DriverType.MYSQL; connection: MySQLConfig; pool?: PoolConfig }
  | { type: DriverType.POSTGRES; connection: PostgreSQLConfig; pool?: PoolConfig }
  | { type: DriverType.MSSQL; connection: MSSQLConfig; pool?: PoolConfig };

export type ConnectionConfig = DriverConfig;
