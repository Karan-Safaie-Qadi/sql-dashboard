import { ReadOnlyGuard } from '../../security/readonly';
import { RateLimiter } from '../../security/ratelimit';
import { validateQuery } from '../../core/validator';
import { Logger } from '../../utils/logger';
import { QueryTimer } from '../../utils/timer';
import { calculatePagination, createPaginatedResult } from '../../utils/pagination';

export async function demoSecurity(): Promise<void> {
  const guard = new ReadOnlyGuard({ enabled: true, allowSelect: true });
  for (const sql of ['SELECT 1', 'INSERT INTO t VALUES (1)', 'DROP TABLE t']) {
    const r = guard.checkReadOnly(sql);
    console.log(`  ReadOnlyGuard [${r.allowed ? 'ALLOW' : 'BLOCK'}]: ${sql}`);
  }

  const limiter = new RateLimiter({ windowMs: 60000, maxQueries: 3 });
  for (let i = 0; i < 5; i++) {
    const r = limiter.check('demo');
    console.log(`  RateLimiter [${r.allowed ? 'ALLOW' : 'DENY'}] req ${i + 1} (${r.remaining} left)`);
  }
  limiter.destroy();

  console.log(`  requireWhere DELETE: ${validateQuery('DELETE FROM users', { requireWhere: true }).valid}`);
  console.log(`  requireWhere DELETE+WHERE: ${validateQuery('DELETE FROM users WHERE id=1', { requireWhere: true }).valid}`);
  console.log(`  banned DROP: ${validateQuery('DROP TABLE users', { bannedStatements: ['DROP', 'TRUNCATE'] }).valid}`);
  console.log(`  maxQueryLength: ${validateQuery('SELECT 1', { maxQueryLength: 5 }).valid}`);
}

export async function demoUtilities(): Promise<void> {
  const logger = new Logger({ level: 'info' });
  logger.startTimer('task');
  await new Promise(r => setTimeout(r, 5));
  const elapsed = logger.endTimer('task');
  console.log(`  Logger timer: ${elapsed.toFixed(2)}ms`);

  const qt = new QueryTimer();
  await new Promise(r => setTimeout(r, 5));
  console.log(`  QueryTimer: ${qt.elapsed.toFixed(2)}ms`);

  const p = calculatePagination({ page: 3, pageSize: 20 });
  console.log(`  Pagination: offset=${p.offset}, limit=${p.limit}`);

  const pr = createPaginatedResult(['a', 'b', 'c'], 50, { page: 1, pageSize: 3 });
  console.log(`  PaginatedResult: ${pr.data.length} items, page ${pr.page}/${pr.totalPages}`);
}
