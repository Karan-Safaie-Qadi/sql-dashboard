import { BaseDriver } from './base.driver';
import { SQLiteDriver } from './sqlite.driver';
import { MySQLDriver } from './mysql.driver';
import { PostgresDriver } from './postgres.driver';
import { MSSQLDriver } from './mssql.driver';
import type { DriverConfig } from '../types';
import { DriverType } from '../types';

export type { BaseDriver };
export { SQLiteDriver, MySQLDriver, PostgresDriver, MSSQLDriver };

export function createDriver(config: DriverConfig): BaseDriver {
  switch (config.type) {
    case DriverType.SQLITE:
      return new SQLiteDriver(config.connection);
    case DriverType.MYSQL:
      return new MySQLDriver(config.connection, config.pool as any);
    case DriverType.POSTGRES:
      return new PostgresDriver(config.connection, config.pool as any);
    case DriverType.MSSQL:
      return new MSSQLDriver(config.connection);
    default:
      throw new Error(`Unsupported driver type: ${(config as DriverConfig).type}`);
  }
}
