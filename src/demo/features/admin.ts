import { SQLDashboard, createDashboard } from '../../engine';
import { DriverType } from '../../types/connection';

export async function demoHistory(db: SQLDashboard): Promise<void> {
  const hist = db.history;

  for (const entry of hist.getRecent(4)) {
    console.log(`  [${entry.status}] ${entry.duration.toFixed(1)}ms | ${entry.query.substring(0, 60)}`);
  }

  const stats = hist.getStats();
  console.log(`  Stats: ${stats.totalQueries} total, ${stats.successfulQueries} ok, ${stats.failedQueries} failed, avg ${stats.avgDuration.toFixed(2)}ms`);

  const filtered = hist.list({ status: 'success', pageSize: 2 });
  console.log(`  Filtered: page ${filtered.page}/${filtered.totalPages} (${filtered.total} total)`);

  const searched = hist.list({ search: 'SELECT', pageSize: 3 });
  console.log(`  Search: ${searched.total} entries match "SELECT"`);
}

export async function demoEvents(db: SQLDashboard): Promise<void> {
  const collected: string[] = [];
  db.on('query', (r) => collected.push(`query:${r.status}:${r.rowCount} rows`));
  await db.query('SELECT 42 as answer');
  await db.query('SELECT 84 as answer');
  for (const e of collected) console.log(`  Event: ${e}`);
  db.removeAllListeners();
}

export async function demoErrors(db: SQLDashboard): Promise<void> {
  const r1 = await db.query('SELECTT invalid syntax');
  console.log(`  Bad SQL: ${r1.status} - ${r1.error}`);

  const r2 = await db.query('INSERT INTO users (name, email) VALUES (?, ?)', { params: ['T', 't@t.com'], readOnly: true });
  console.log(`  ReadOnly: ${r2.status} - ${r2.error}`);

  const r3 = await db.query('DELETE FROM users');
  console.log(`  Missing WHERE: ${r3.status} - ${r3.error}`);
}

export async function demoExplain(db: SQLDashboard): Promise<void> {
  const plan = await db.explain('SELECT u.name, COUNT(p.id) FROM users u JOIN posts p ON p.user_id = u.id GROUP BY u.name');
  console.log(`  EXPLAIN: ${plan.rowCount} plan steps (${plan.duration.toFixed(1)}ms)`);
}

export async function demoStatus(db: SQLDashboard): Promise<void> {
  const s = await db.status();
  console.log(`  Status: connected=${s.connected} driver=${s.driver} ver=${s.version} dbver=${s.databaseVersion}`);
  console.log(`  History: ${s.history.total} queries, ${s.history.successful} ok`);

  const dbs = await db.getDatabases();
  console.log(`  Databases: ${dbs.join(', ')}`);

  db.updateSecurity({ readOnly: { enabled: true, allowSelect: true } });
  const r = await db.query('SELECT COUNT(*) as c FROM users');
  console.log(`  Dynamic security: ${r.status} (${r.rowCount} rows)`);
  db.updateSecurity({ readOnly: { enabled: false } });
}

export async function demoFactory(): Promise<void> {
  const db = createDashboard({ driver: { type: DriverType.SQLITE, connection: { mode: 'memory' } }, logger: { level: 'silent' }, autoConnect: false });
  await db.connect();
  const s = await db.status();
  console.log(`  Factory: v${s.version}, ${s.driver}`);
  db.destroy();
}
