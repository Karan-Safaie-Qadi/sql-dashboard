import type { QueryHistoryEntry, QueryResult, PaginatedResult } from '../types';
import { createPaginatedResult } from '../utils/pagination';

interface HistoryStorage {
  getEntries(): QueryHistoryEntry[];
  addEntry(entry: QueryHistoryEntry): void;
  clear(): void;
  removeEntry(id: string): void;
}

class MemoryStorage implements HistoryStorage {
  private entries: QueryHistoryEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 500) {
    this.maxEntries = maxEntries;
  }

  getEntries(): QueryHistoryEntry[] {
    return [...this.entries];
  }

  addEntry(entry: QueryHistoryEntry): void {
    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }
  }

  clear(): void {
    this.entries = [];
  }

  removeEntry(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
  }
}

export class QueryHistory {
  private storage: HistoryStorage;

  constructor(maxEntries: number = 500) {
    this.storage = new MemoryStorage(maxEntries);
  }

  record(result: QueryResult, database: string, user?: string): QueryHistoryEntry {
    const entry: QueryHistoryEntry = {
      id: result.id,
      query: result.query.length > 500 ? result.query.substring(0, 500) + '...' : result.query,
      executedAt: new Date(),
      duration: result.duration,
      status: result.status,
      rowCount: result.rowCount,
      database,
      user,
    };
    this.storage.addEntry(entry);
    return entry;
  }

  list(params: {
    page?: number;
    pageSize?: number;
    database?: string;
    status?: string;
    search?: string;
  } = {}): PaginatedResult<QueryHistoryEntry> {
    let entries = this.storage.getEntries();

    if (params.database) {
      entries = entries.filter((e) => e.database === params.database);
    }
    if (params.status) {
      entries = entries.filter((e) => e.status === params.status);
    }
    if (params.search) {
      const lower = params.search.toLowerCase();
      entries = entries.filter((e) => e.query.toLowerCase().includes(lower));
    }

    const total = entries.length;
    const { page = 1, pageSize = 50 } = params;
    const start = (page - 1) * pageSize;
    const data = entries.slice(start, start + pageSize);

    return createPaginatedResult(data, total, { page, pageSize });
  }

  getRecent(limit: number = 10): QueryHistoryEntry[] {
    return this.storage.getEntries().slice(0, limit);
  }

  getStats(): {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    avgDuration: number;
  } {
    const entries = this.storage.getEntries();
    const successful = entries.filter((e) => e.status === 'success').length;
    const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);
    return {
      totalQueries: entries.length,
      successfulQueries: successful,
      failedQueries: entries.length - successful,
      avgDuration: entries.length > 0 ? totalDuration / entries.length : 0,
    };
  }

  clear(): void {
    this.storage.clear();
  }

  remove(id: string): void {
    this.storage.removeEntry(id);
  }
}
