import type { PaginatedResult } from '../types';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  offset?: number;
}

export function calculatePagination(params: PaginationParams): { limit: number; offset: number } {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 50), 1000);
  const offset = params.offset ?? (page - 1) * pageSize;
  return { limit: pageSize, offset };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 50), 1000);
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function paginateQuery(
  query: string,
  params: PaginationParams
): { query: string; limit: number; offset: number } {
  const { limit, offset } = calculatePagination(params);
  const trimmed = query.trim().replace(/;+$/, '');
  const hasLimit = /\bLIMIT\s+\d+/i.test(trimmed);
  const hasOffset = /\bOFFSET\s+\d+/i.test(trimmed);

  if (hasLimit || hasOffset) {
    return { query: trimmed, limit, offset };
  }

  return {
    query: `${trimmed} LIMIT ${limit} OFFSET ${offset}`,
    limit,
    offset,
  };
}
