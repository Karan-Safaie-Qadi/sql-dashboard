import type { DriverConfig } from './connection';
import type { SecurityConfig } from './security';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerConfig {
  level?: LogLevel;
  queries?: boolean;
  slowQueryThreshold?: number;
  format?: 'json' | 'text';
}

export interface DashboardOptions {
  driver: DriverConfig;
  security?: SecurityConfig;
  logger?: LoggerConfig;
  autoConnect?: boolean;
}

export interface DashboardConfig extends Required<DashboardOptions> {
  version: string;
}
