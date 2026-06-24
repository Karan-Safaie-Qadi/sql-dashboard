import { EventEmitter } from 'eventemitter3';
import { createDriver, BaseDriver } from './drivers';
import { SchemaBrowser, QueryHistory } from './admin';
import { ReadOnlyGuard, RateLimiter } from './security';
import { Logger } from './utils/logger';
import { QueryTimer } from './utils/timer';
import { validateQuery } from './core/validator';
import { detectInjection, prepareBatchQueries } from './core/sanitizer';
import { truncateResult } from './core/formatter';
import type {
  DashboardOptions,
  QueryResult,
  QueryOptions,
  ValidationResult,
  DashboardConfig,
  SecurityConfig,
} from './types';

type DashboardEvents = {
  query: (result: QueryResult) => void;
  error: (error: Error, query?: string) => void;
  connect: () => void;
  disconnect: () => void;
  warning: (warning: string) => void;
};

export class SQLDashboard extends EventEmitter<DashboardEvents> {
  public readonly schema: SchemaBrowser;
  public readonly history: QueryHistory;
  public readonly config: DashboardConfig;
  public readonly version: string = '1.0.1';

  private driver: BaseDriver;
  private logger: Logger;
  private readOnlyGuard?: ReadOnlyGuard;
  private rateLimiter?: RateLimiter;
  private connected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(options: DashboardOptions) {
    super();

    this.config = {
      driver: options.driver,
      security: options.security || {},
      logger: options.logger || { level: 'info', queries: true, slowQueryThreshold: 1000, format: 'text' },
      autoConnect: options.autoConnect ?? true,
      version: this.version,
    };

    this.logger = new Logger(this.config.logger);
    this.driver = createDriver(this.config.driver);

    this.schema = new SchemaBrowser(this.driver);
    this.history = new QueryHistory();

    this.setupSecurity();
    this.setupEventHandlers();

    if (this.config.autoConnect) {
      this.connect().catch((err) => {
        this.logger.error(`Auto-connect failed: ${err.message}`);
      });
    }
  }

  private setupSecurity(): void {
    const security = this.config.security;
    if (!security) return;

    if (security.readOnly) {
      this.readOnlyGuard = new ReadOnlyGuard(
        typeof security.readOnly === 'object' ? security.readOnly : undefined
      );
    }

    if (security.rateLimit) {
      this.rateLimiter = new RateLimiter(security.rateLimit);
    }
  }

  private setupEventHandlers(): void {
    this.on('error', (error) => {
      this.logger.error(`Dashboard error: ${error.message}`);
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this.driver.connect().then(() => {
      this.connected = true;
      this.connectionPromise = null;
      this.logger.info(`Connected to ${this.driver.type} database`);
      this.emit('connect');
    }).catch((err) => {
      this.connectionPromise = null;
      this.emit('error', err);
      throw err;
    });

    return this.connectionPromise;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.driver.disconnect();
    this.connected = false;
    this.logger.info('Disconnected from database');
    this.emit('disconnect');
  }

  async query(sql: string, options?: QueryOptions): Promise<QueryResult> {
    await this.ensureConnected();

    const timer = new QueryTimer();
    const opts: QueryOptions = {
      timeout: options?.timeout ?? this.config.security?.queryTimeout ?? 30000,
      params: options?.params,
      readOnly: options?.readOnly ?? this.config.security?.readOnly === true,
      maxRows: options?.maxRows ?? this.config.security?.maxRows ?? 1000,
    };

    const validation = this.validateQuery(sql, opts);
    if (!validation.valid) {
      const errorResult: QueryResult = {
        id: crypto.randomUUID(),
        status: 'error',
        rows: [],
        columns: [],
        rowCount: 0,
        duration: 0,
        query: sql,
        error: validation.errors.map((e) => e.message).join('; '),
      };
      this.emit('error', new Error(errorResult.error!), sql);
      return errorResult;
    }

    if (detectInjection(sql)) {
      const errorResult: QueryResult = {
        id: crypto.randomUUID(),
        status: 'error',
        rows: [],
        columns: [],
        rowCount: 0,
        duration: 0,
        query: sql,
        error: 'Potential SQL injection detected',
      };
      this.emit('error', new Error('SQL injection detected'), sql);
      return errorResult;
    }

    try {
      const queryPromise = opts.params
        ? this.driver.executeQuery(sql, opts.params)
        : this.driver.executeQuery(sql);

      const result = await this.withTimeout(queryPromise, opts.timeout!);
      const truncated = truncateResult(result.rows, opts.maxRows!);

      const finalResult: QueryResult = {
        ...result,
        rows: truncated.rows,
        rowCount: truncated.truncated ? truncated.rows.length : result.rowCount,
        warning: truncated.truncated
          ? `Results truncated to ${opts.maxRows} rows. Total results: ${result.rowCount}`
          : undefined,
      };

      this.logger.query(sql, finalResult.duration, finalResult.rowCount);
      this.history.record(finalResult, this.getDriverType());
      this.emit('query', finalResult);

      return finalResult;
    } catch (error) {
      const errorResult = this.driver['createErrorResult'](sql, error as Error, timer.elapsed);
      this.history.record(errorResult, this.getDriverType());
      this.emit('error', error as Error, sql);

      if (errorResult.error) {
        this.logger.error(`Query failed: ${errorResult.error}`);
      }

      return errorResult;
    }
  }

  async execute(sql: string, options?: QueryOptions): Promise<QueryResult> {
    return this.query(sql, options);
  }

  async batch(queries: string[]): Promise<QueryResult[]> {
    await this.ensureConnected();
    const results: QueryResult[] = [];

    for (const query of queries) {
      const result = await this.query(query);
      results.push(result);
      if (result.status === 'error') break;
    }

    return results;
  }

  async executeBatch(sql: string): Promise<QueryResult[]> {
    const queries = prepareBatchQueries(sql);
    return this.batch(queries);
  }

  async transaction<T>(callback: (query: (sql: string, params?: unknown[]) => Promise<QueryResult>) => Promise<T>): Promise<T> {
    await this.ensureConnected();
    await this.query('BEGIN');
    try {
      const result = await callback(async (sql, params) => {
        return this.query(sql, { params, transaction: true });
      });
      await this.query('COMMIT');
      return result;
    } catch (error) {
      await this.query('ROLLBACK');
      throw error;
    }
  }

  async explain(sql: string): Promise<QueryResult> {
    const explainSql = `EXPLAIN ${sql.trim().replace(/;$/, '')}`;
    return this.query(explainSql);
  }

  async analyze(sql: string): Promise<QueryResult> {
    const analyzeSql = `EXPLAIN ANALYZE ${sql.trim().replace(/;$/, '')}`;
    return this.query(analyzeSql);
  }

  async status(): Promise<{
    connected: boolean;
    driver: string;
    version: string;
    uptime: number;
    history: { total: number; successful: number; failed: number };
    databaseVersion?: string;
  }> {
    let dbVersion: string | undefined;
    try {
      if (this.connected) {
        dbVersion = await this.driver.getVersion();
      }
    } catch { }

    const histStats = this.history.getStats();
    return {
      connected: this.connected,
      driver: this.driver.type,
      version: this.version,
      uptime: process.uptime(),
      history: {
        total: histStats.totalQueries,
        successful: histStats.successfulQueries,
        failed: histStats.failedQueries,
      },
      databaseVersion: dbVersion,
    };
  }

  async getDriverVersion(): Promise<string> {
    await this.ensureConnected();
    return this.driver.getVersion();
  }

  async getDatabases(): Promise<string[]> {
    await this.ensureConnected();
    return this.driver.getDatabases();
  }

  validate(sql: string): ValidationResult {
    return validateQuery(sql, this.config.security);
  }

  private validateQuery(sql: string, options: QueryOptions): ValidationResult {
    const result = validateQuery(sql, this.config.security);

    if (options.readOnly && !result.isReadOnly) {
      result.valid = false;
      result.errors.push({
        code: 'READ_ONLY',
        message: 'Query is not allowed in read-only mode',
        severity: 'error',
      });
    }

    return result;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    if (ms <= 0) return promise;
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
      ),
    ]);
  }

  private getDriverType(): string {
    return this.driver.type;
  }

  updateSecurity(config: Partial<SecurityConfig>): void {
    if (config.readOnly !== undefined) {
      if (this.readOnlyGuard) {
        this.readOnlyGuard.updateRule(
          typeof config.readOnly === 'object' ? config.readOnly : { enabled: config.readOnly }
        );
      } else if (config.readOnly) {
        this.readOnlyGuard = new ReadOnlyGuard(
          typeof config.readOnly === 'object' ? config.readOnly : undefined
        );
      }
    }

    if (config.rateLimit && this.rateLimiter) {
      this.rateLimiter.updateConfig(config.rateLimit);
    }

    this.config.security = { ...this.config.security, ...config };
  }

  destroy(): void {
    this.rateLimiter?.destroy();
    this.disconnect().catch(() => { });
    this.removeAllListeners();
  }
}

export function createDashboard(options: DashboardOptions): SQLDashboard {
  return new SQLDashboard(options);
}
