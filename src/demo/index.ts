import { SQLDashboard, createDashboard } from '../engine';
import { ReadOnlyGuard } from '../security/readonly';
import { RateLimiter } from '../security/ratelimit';
import { DriverType } from '../types/connection';
import { toCSV, toJSON, toJSONLines, toJSONArray } from '../export';
import { validateQuery, isReadOnlyStatement, detectStatementType } from '../core/validator';
import { detectInjection, sanitizeIdentifier } from '../core/sanitizer';
import { formatSQL, formatResultRow } from '../core/formatter';
import { calculatePagination, createPaginatedResult } from '../utils/pagination';
import { Logger } from '../utils/logger';
import { QueryTimer } from '../utils/timer';
import type { DashboardOptions, QueryResult } from '../types';

const DIVIDER = '='.repeat(68);
const SUBDIVIDER = '-'.repeat(68);

function heading(title: string): void {
  console.log(`\n${DIVIDER}`);
  console.log(`  ${title}`);
  console.log(DIVIDER);
}

function subheading(title: string): void {
  console.log(`\n${SUBDIVIDER}`);
  console.log(`  ${title}`);
  console.log(SUBDIVIDER);
}

function printResult(result: QueryResult): void {
  if (result.status === 'error') {
    console.log(`  [ERROR] ${result.error}`);
    return;
  }
  console.log(`  Duration: ${result.duration.toFixed(2)}ms  |  Rows: ${result.rowCount}`);
  if (result.affectedRows !== undefined) {
    console.log(`  Affected rows: ${result.affectedRows}`);
  }
  if (result.warning) {
    console.log(`  [WARNING] ${result.warning}`);
  }
  if (result.rows.length > 0) {
    console.log(`  Columns: ${result.columns.join(', ')}`);
    console.log(`  First 3 rows:`);
    for (let i = 0; i < Math.min(3, result.rows.length); i++) {
      console.log(`    [${i + 1}] ${JSON.stringify(result.rows[i])}`);
    }
  }
}


async function demoBasicSetup(): Promise<SQLDashboard> {
  heading('1. BASIC SETUP');

  const options: DashboardOptions = {
    driver: {
      type: DriverType.SQLITE,
      connection: { mode: 'memory' },
    },
    logger: { level: 'silent' },
    autoConnect: false,
    security: {
      requireWhere: true,
      bannedStatements: ['TRUNCATE'],
      maxRows: 100,
      queryTimeout: 5000,
    },
  };

  console.log('  Creating dashboard with SQLite (in-memory)...');
  const db = createDashboard(options);
  await db.connect();
  console.log('  [OK] Connected to SQLite database');

  const status = await db.status();
  console.log(`  Dashboard Version: ${status.version}`);
  console.log(`  Driver: ${status.driver}`);
  console.log(`  Connected: ${status.connected}`);

  return db;
}

async function demoTableCreation(db: SQLDashboard): Promise<void> {
  heading('2. TABLE CREATION & DATA');

  subheading('Creating tables');
  const createUsers = await db.query(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'user',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  printResult(createUsers);

  const createPosts = await db.query(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      published INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  printResult(createPosts);

  const createComments = await db.query(`
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  printResult(createComments);

  subheading('Inserting sample data');
  const users = [
    { name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
    { name: 'Bob Smith', email: 'bob@example.com', role: 'editor' },
    { name: 'Charlie Brown', email: 'charlie@example.com', role: 'user' },
    { name: 'Diana Prince', email: 'diana@example.com', role: 'user' },
    { name: 'Eve Wilson', email: 'eve@example.com', role: 'editor' },
  ];

  for (const u of users) {
    const r = await db.query(
      'INSERT INTO users (name, email, role) VALUES (?, ?, ?)',
      { params: [u.name, u.email, u.role] }
    );
    printResult(r);
  }

  await db.query(`INSERT INTO posts (user_id, title, body) VALUES (1, 'Getting Started with SQL', 'SQL is a powerful language...')`);
  await db.query(`INSERT INTO posts (user_id, title, body) VALUES (1, 'Advanced Queries', 'Learn about joins and subqueries...')`);
  await db.query(`INSERT INTO posts (user_id, title, body) VALUES (2, 'Database Design Tips', 'Normalization and indexing...')`);
  await db.query(`INSERT INTO posts (user_id, title, body, published) VALUES (2, 'Performance Tuning', 'Optimize your queries...', 1)`);
  await db.query(`INSERT INTO posts (user_id, title, body, published) VALUES (3, 'Hello World', 'My first post!', 1)`);

  await db.query(`INSERT INTO comments (post_id, user_id, content) VALUES (1, 2, 'Great article!')`);
  await db.query(`INSERT INTO comments (post_id, user_id, content) VALUES (1, 3, 'Very helpful, thanks!')`);
  await db.query(`INSERT INTO comments (post_id, user_id, content) VALUES (2, 4, 'Can you explain joins more?')`);
  await db.query(`INSERT INTO comments (post_id, user_id, content) VALUES (3, 1, 'Nice tips!')`);

  console.log('  [OK] Sample data inserted');
}

async function demoQueryExecution(db: SQLDashboard): Promise<void> {
  heading('3. QUERY EXECUTION');

  subheading('Simple SELECT');
  const allUsers = await db.query('SELECT id, name, email, role FROM users');
  printResult(allUsers);

  subheading('SELECT with WHERE clause');
  const admins = await db.query("SELECT * FROM users WHERE role = 'admin'");
  printResult(admins);

  subheading('Parameterized query (prepared statement)');
  const editorUsers = await db.query(
    'SELECT id, name, email FROM users WHERE role = ?',
    { params: ['editor'] }
  );
  printResult(editorUsers);

  subheading('JOIN query across tables');
  const postsWithUsers = await db.query(`
    SELECT p.id, p.title, u.name as author, p.published, p.created_at
    FROM posts p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
  `);
  printResult(postsWithUsers);

  subheading('Aggregate query with GROUP BY');
  const stats = await db.query(`
    SELECT u.role, COUNT(DISTINCT u.id) as user_count, COUNT(p.id) as post_count
    FROM users u
    LEFT JOIN posts p ON p.user_id = u.id
    GROUP BY u.role
  `);
  printResult(stats);

  subheading('Query with LIMIT and maxRows protection');
  const limited = await db.query('SELECT * FROM users', { maxRows: 2 });
  printResult(limited);
  if (limited.warning) console.log(`  [DEMO] ${limited.warning}`);

  subheading('Query timeout demonstration');
  const fastResult = await db.query('SELECT 1 + 1 as result', { timeout: 1000 });
  printResult(fastResult);
}

async function demoTransaction(db: SQLDashboard): Promise<void> {
  heading('4. TRANSACTIONS');

  subheading('Successful transaction');
  try {
    const txResult = await db.transaction(async (query) => {
      const r1 = await query("INSERT INTO users (name, email, role) VALUES ('Transaction User', 'tx@example.com', 'user')");
      console.log(`  Inserted user: ${r1.affectedRows} row(s)`);
      const r2 = await query('SELECT COUNT(*) as count FROM users');
      console.log(`  Total users now: ${JSON.stringify(r2.rows[0].count)}`);
      return 'Transaction completed successfully';
    });
    console.log(`  [OK] ${txResult}`);
  } catch (err) {
    console.log(`  [ERROR] Transaction failed: ${(err as Error).message}`);
  }

  subheading('Transaction with rollback on error');
  try {
    await db.transaction(async (query) => {
      await query("INSERT INTO users (name, email, role) VALUES ('Rollback User', 'rollback@example.com', 'user')");
      await query("INSERT INTO invalid_table (x) VALUES (1)");
    });
  } catch (err) {
    console.log(`  [OK] Transaction rolled back: ${(err as Error).message}`);
  }

  const afterTx = await db.query("SELECT COUNT(*) as count FROM users WHERE email LIKE '%tx@example.com%'");
  console.log(`  Rollback user present: ${afterTx.rows[0].count === 0}`);
}

async function demoBatchQueries(db: SQLDashboard): Promise<void> {
  heading('5. BATCH QUERIES');

  const results = await db.batch([
    'SELECT COUNT(*) as total_users FROM users',
    'SELECT COUNT(*) as total_posts FROM posts',
    'SELECT COUNT(*) as total_comments FROM comments',
  ]);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'success' && r.rows.length > 0) {
      console.log(`  Query ${i + 1}: ${JSON.stringify(r.rows[0])} (${r.duration.toFixed(1)}ms)`);
    }
  }

  subheading('Batch with executeBatch (semicolon-separated)');
  const batchResult = await db.executeBatch(`
    SELECT 'quick_check' as test, 42 as answer;
    SELECT name, email FROM users LIMIT 2;
  `);
  for (const r of batchResult) {
    console.log(`  [${r.status}] "${r.query.substring(0, 40)}..." => ${r.rowCount} rows (${r.duration.toFixed(1)}ms)`);
  }
}

async function demoSchemaBrowsing(db: SQLDashboard): Promise<void> {
  heading('6. SCHEMA BROWSING');

  subheading('All tables');
  const tables = await db.schema.getTables();
  for (const t of tables) {
    console.log(`  TABLE: ${t.name} (${t.columns.length} columns, ${t.rowCount} rows)`);
    console.log(`    Columns:`);
    for (const c of t.columns) {
      const pk = c.primaryKey ? ' PK' : '';
      const nn = !c.nullable ? ' NOT NULL' : '';
      const def = c.defaultValue ? ` DEFAULT ${c.defaultValue}` : '';
      console.log(`      - ${c.name}: ${c.type}${pk}${nn}${def}`);
    }
  }

  subheading('Indexes per table');
  for (const t of tables) {
    const indexes = await db.schema.getIndexes(t.name);
    if (indexes.length > 0) {
      console.log(`  ${t.name}:`);
      for (const idx of indexes) {
        console.log(`    - ${idx.name} (${idx.columns.join(', ')}) [${idx.type}]`);
      }
    }
  }

  subheading('Foreign keys');
  for (const t of tables) {
    const fks = await db.schema.getForeignKeys(t.name);
    if (fks.length > 0) {
      console.log(`  ${t.name}:`);
      for (const fk of fks) {
        console.log(`    - ${fk.column} -> ${fk.referencedTable}(${fk.referencedColumn})`);
      }
    }
  }

  subheading('Table summary');
  const summary = await db.schema.getTableSummary('users');
  console.log(`  Table: ${summary.name}`);
  console.log(`  Columns: ${summary.columnCount}, Indexes: ${summary.indexCount}`);
  console.log(`  Foreign Keys: ${summary.foreignKeyCount}, Rows: ${summary.rowCount}`);

  subheading('Search tables');
  const searchResults = await db.schema.searchTables('user');
  console.log(`  Tables matching "user": ${searchResults.map(t => t.name).join(', ')}`);

  subheading('Full schema info');
  const schema = await db.schema.getSchema();
  console.log(`  Database: ${schema.name}`);
  console.log(`  Tables: ${schema.tables.length}, Views: ${schema.views.length}`);
}

async function demoViews(db: SQLDashboard): Promise<void> {
  heading('7. VIEWS');

  subheading('Creating a view');
  await db.query(`
    CREATE VIEW user_post_counts AS
    SELECT u.id, u.name, u.email, COUNT(p.id) as post_count
    FROM users u
    LEFT JOIN posts p ON p.user_id = u.id
    GROUP BY u.id, u.name, u.email
  `);
  console.log('  [OK] View created: user_post_counts');

  subheading('Querying the view');
  const viewData = await db.query('SELECT * FROM user_post_counts ORDER BY post_count DESC');
  printResult(viewData);

  subheading('Listing views');
  const views = await db.schema.getViews();
  for (const v of views) {
    console.log(`  VIEW: ${v.name}`);
    console.log(`  Definition: ${v.definition.substring(0, 80)}...`);
  }
}

async function demoExplainAnalyze(db: SQLDashboard): Promise<void> {
  heading('8. EXPLAIN & ANALYZE');

  subheading('EXPLAIN a query');
  const plan = await db.explain('SELECT u.name, COUNT(p.id) FROM users u JOIN posts p ON p.user_id = u.id GROUP BY u.name');
  printResult(plan);

  subheading('EXPLAIN ANALYZE');
  const analyzed = await db.analyze('SELECT * FROM users WHERE active = 1');
  printResult(analyzed);
}

async function demoQueryHistory(db: SQLDashboard): Promise<void> {
  heading('9. QUERY HISTORY');

  const history = db.history;

  subheading('Recent queries');
  const recent = history.getRecent(5);
  for (const entry of recent) {
    const icon = entry.status === 'success' ? 'OK' : 'ERROR';
    console.log(`  [${icon}] ${entry.duration.toFixed(1)}ms | ${entry.query.substring(0, 70)}...`);
  }

  subheading('History statistics');
  const stats = history.getStats();
  console.log(`  Total: ${stats.totalQueries}`);
  console.log(`  Successful: ${stats.successfulQueries}`);
  console.log(`  Failed: ${stats.failedQueries}`);
  console.log(`  Avg duration: ${stats.avgDuration.toFixed(2)}ms`);

  subheading('Filtered history (success only)');
  const successHistory = history.list({ status: 'success', pageSize: 3 });
  console.log(`  Page ${successHistory.page}/${successHistory.totalPages} (${successHistory.total} total)`);
  for (const entry of successHistory.data) {
    console.log(`  - ${entry.query.substring(0, 60)}`);
  }

  subheading('Search history');
  const searchResults = history.list({ search: 'SELECT', pageSize: 3 });
  console.log(`  Found ${searchResults.total} entries matching "SELECT"`);

  subheading('Paginated history');
  const page1 = history.list({ page: 1, pageSize: 3 });
  const page2 = history.list({ page: 2, pageSize: 3 });
  console.log(`  Page 1: ${page1.data.length} entries | Page 2: ${page2.data.length} entries`);
  console.log(`  Total: ${page1.total} entries across ${page1.totalPages} pages`);
}

async function demoExport(db: SQLDashboard): Promise<void> {
  heading('10. EXPORT FUNCTIONS');

  const users = await db.query('SELECT id, name, email, role, active FROM users LIMIT 3');

  subheading('CSV Export');
  const csv = toCSV(users);
  console.log(`  ${csv.split('\n').slice(0, 4).join('\n  ')}`);

  subheading('CSV with custom options');
  const csvTabs = toCSV(users, { delimiter: '\t', nullValue: '<null>' });
  console.log(`  ${csvTabs.split('\n').slice(0, 2).join('\n  ')}`);

  subheading('JSON Export (pretty)');
  const jsonPretty = toJSON(users, { pretty: true, indent: 2 });
  console.log(`  ${jsonPretty.substring(0, 200)}...`);

  subheading('JSON with metadata');
  const jsonMeta = toJSON(users, { includeMeta: true });
  console.log(`  ${jsonMeta.substring(0, 200)}...`);

  subheading('JSON Lines');
  const jsonl = toJSONLines(users);
  console.log(`  ${jsonl.split('\n').slice(0, 2).join('\n  ')}`);

  subheading('JSON Array (compact)');
  const jsonArr = toJSONArray(users);
  console.log(`  ${jsonArr.substring(0, 150)}...`);
}

async function demoValidation(db: SQLDashboard): Promise<void> {
  heading('11. SQL VALIDATION');

  const testQueries = [
    'SELECT * FROM users',
    "INSERT INTO users (name, email) VALUES ('Test', 'test@test.com')",
    'DROP TABLE users',
    '',
    'DELETE FROM users',
    'SELECT * FROM users WHERE id = 1 OR 1=1',
  ];

  for (const sql of testQueries) {
    const validation = validateQuery(sql, db.config.security);
    const type = detectStatementType(sql);
    const readOnly = isReadOnlyStatement(sql);
    const status = validation.valid ? 'VALID' : 'INVALID';
    const errors = validation.errors.map(e => e.message).join('; ');

    console.log(`  [${status}] Type=${type} ReadOnly=${readOnly}`);
    if (sql) console.log(`    SQL: ${sql.substring(0, 60)}`);
    if (errors) console.log(`    Errors: ${errors}`);
  }

  subheading('Statement type detection');
  const types = [
    'SELECT * FROM users',
    'INSERT INTO users VALUES (1)',
    'UPDATE users SET name = ? WHERE id = ?',
    'DELETE FROM users WHERE id = ?',
    'CREATE TABLE test (id INT)',
    'ALTER TABLE users ADD COLUMN age INT',
    'DROP TABLE users',
  ];
  for (const sql of types) {
    console.log(`  ${detectStatementType(sql).padEnd(10)} => ${sql}`);
  }

  subheading('Table name extraction');
  const tableQueries = [
    'SELECT * FROM users JOIN posts ON users.id = posts.user_id',
    'INSERT INTO comments (post_id, content) VALUES (1, "hello")',
    'UPDATE users SET name = ? WHERE id = ?',
  ];
  const extractTableNames = (await import('../core/validator')).extractTableNames;
  for (const sql of tableQueries) {
    console.log(`  Tables in "${sql.substring(0, 50)}...": ${extractTableNames(sql).join(', ')}`);
  }
}

async function demoFormatting(): Promise<void> {
  heading('12. SQL FORMATTING');

  const uglySQL = "select u.id,u.name,count(p.id) as post_count from users u left join posts p on p.user_id=u.id where u.active=1 group by u.id,u.name having count(p.id)>0 order by post_count desc limit 10 offset 0";

  console.log('  Before:');
  console.log(`  ${uglySQL}`);

  console.log('\n  After formatSQL():');
  const formatted = formatSQL(uglySQL, { uppercase: true, indent: '  ' });
  console.log(`  ${formatted}`);

  subheading('Result row formatting');
  const sampleRow = { id: 1, name: 'Alice', score: null, data: Buffer.from('hello') };
  const formattedRow = formatResultRow(sampleRow);
  console.log(`  Original: ${JSON.stringify(sampleRow)}`);
  console.log(`  Formatted: ${JSON.stringify(formattedRow)}`);
}

async function demoInjectionDetection(): Promise<void> {
  heading('13. SQL INJECTION DETECTION');

  const injections = [
    "SELECT * FROM users WHERE id = 1 OR 1=1",
    "SELECT * FROM users; DROP TABLE users;",
    "SELECT * FROM users WHERE name = '' OR '1'='1'",
    "SELECT * FROM users UNION SELECT * FROM admins",
  ];

  for (const sql of injections) {
    const detected = detectInjection(sql);
    const icon = detected ? 'DETECTED' : 'SAFE';
    console.log(`  [${icon}] ${sql.substring(0, 60)}`);
  }

  subheading('Identifier sanitization');
  const dirtyNames = ['user table', '123table', 'select;drop', 'valid_name'];
  for (const name of dirtyNames) {
    console.log(`  "${name}" => "${sanitizeIdentifier(name)}"`);
  }
}

async function demoSecurityFeatures(): Promise<void> {
  heading('14. SECURITY FEATURES');

  subheading('ReadOnlyGuard');
  const guard = new ReadOnlyGuard({ enabled: true, allowSelect: true });

  const guardedQueries = [
    'SELECT * FROM users',
    'INSERT INTO users VALUES (1, "test")',
    'DROP TABLE users',
    'SHOW TABLES',
  ];

  for (const sql of guardedQueries) {
    const result = guard.checkReadOnly(sql);
    const status = result.allowed ? 'ALLOWED' : 'BLOCKED';
    console.log(`  [${status}] ${sql}`);
    if (result.reason) console.log(`    Reason: ${result.reason}`);
  }

  subheading('RateLimiter');
  const limiter = new RateLimiter({ windowMs: 60000, maxQueries: 5 });
  const clientKey = 'demo-client';

  for (let i = 0; i < 7; i++) {
    const result = limiter.check(clientKey);
    const status = result.allowed ? 'ALLOWED' : 'BLOCKED';
    console.log(`  [${status}] Request ${i + 1} (${result.remaining} remaining)`);
  }

  subheading('Security validation with requireWhere');
  const noWhere = 'DELETE FROM users';
  const withWhere = "DELETE FROM users WHERE id = 1";
  const config = { requireWhere: true };
  console.log(`  "${noWhere}" valid? ${validateQuery(noWhere, config).valid}`);
  console.log(`  "${withWhere}" valid? ${validateQuery(withWhere, config).valid}`);

  subheading('Banned statements');
  const bannedConfig = { bannedStatements: ['DROP', 'TRUNCATE'] };
  console.log(`  "DROP TABLE users" valid? ${validateQuery('DROP TABLE users', bannedConfig).valid}`);
  console.log(`  "SELECT * FROM users" valid? ${validateQuery('SELECT * FROM users', bannedConfig).valid}`);

  subheading('Max query length');
  const lengthConfig = { maxQueryLength: 50 };
  const short = 'SELECT 1';
  const long = 'SELECT ' + 'x'.repeat(60);
  console.log(`  Short query valid? ${validateQuery(short, lengthConfig).valid}`);
  console.log(`  Long query valid? ${validateQuery(long, lengthConfig).valid}`);
}

async function demoUtilities(): Promise<void> {
  heading('15. UTILITIES');

  subheading('Logger');
  const logger = new Logger({ level: 'info', format: 'text' });
  logger.info('Demo info message');
  logger.warn('Demo warning message');
  logger.startTimer('demo_task');
  await new Promise(r => setTimeout(r, 10));
  const elapsed = logger.endTimer('demo_task');
  console.log(`  Timer "demo_task" took ${elapsed.toFixed(2)}ms`);

  subheading('QueryTimer');
  const qt = new QueryTimer();
  await new Promise(r => setTimeout(r, 5));
  console.log(`  Elapsed: ${qt.elapsed.toFixed(2)}ms`);
  const result = await QueryTimer.measure(async () => {
    await new Promise(r => setTimeout(r, 5));
    return 'done';
  });
  console.log(`  Measured: ${result.duration.toFixed(2)}ms => ${result.result}`);

  subheading('Pagination utilities');
  const calc1 = calculatePagination({ page: 1, pageSize: 20 });
  console.log(`  Page 1, size 20: offset=${calc1.offset}, limit=${calc1.limit}`);
  const calc2 = calculatePagination({ page: 5, pageSize: 10 });
  console.log(`  Page 5, size 10: offset=${calc2.offset}, limit=${calc2.limit}`);

  const paginated = createPaginatedResult(['a', 'b', 'c'], 100, { page: 1, pageSize: 3 });
  console.log(`  Paginated: ${paginated.data.length} items, page ${paginated.page}/${paginated.totalPages}, total=${paginated.total}`);
}

async function demoEventSystem(db: SQLDashboard): Promise<void> {
  heading('16. EVENT SYSTEM');

  const events: string[] = [];

  db.on('query', (result) => {
    events.push(`query:${result.status}:${result.duration.toFixed(1)}ms`);
  });

  db.on('error', (_error, query) => {
    events.push(`error:${query?.substring(0, 30)}`);
  });

  db.on('connect', () => {
    events.push('connect');
  });

  db.on('disconnect', () => {
    events.push('disconnect');
  });

  await db.query('SELECT 1 as test');
  await db.query('SELECT 2 as test');

  console.log('  Events captured:');
  for (const e of events.slice(-6)) {
    console.log(`    - ${e}`);
  }

  db.removeAllListeners();
}

async function demoErrorHandling(db: SQLDashboard): Promise<void> {
  heading('17. ERROR HANDLING');

  subheading('Invalid SQL syntax');
  const invalid = await db.query('SELECTT * FRoM userss');
  printResult(invalid);

  subheading('Query timeout');
  const timeoutResult = await db.query('SELECT 1', { timeout: 1 });
  printResult(timeoutResult);

  subheading('Read-only enforcement');
  const roResult = await db.query('INSERT INTO users (name, email) VALUES (?, ?)', {
    params: ['Test', 'test@test.com'],
    readOnly: true,
  });
  printResult(roResult);

  subheading('Missing WHERE clause (requireWhere)');
  const deleteAll = await db.query('DELETE FROM users');
  printResult(deleteAll);
}

async function demoUpdateSecurity(db: SQLDashboard): Promise<void> {
  heading('18. DYNAMIC SECURITY UPDATE');

  console.log('  Initial readOnly: false');
  console.log('  Updating security to readOnly...');

  db.updateSecurity({
    readOnly: { enabled: true, allowSelect: true },
  });

  const allowed = await db.query('SELECT COUNT(*) as cnt FROM users');
  console.log(`  SELECT allowed: ${allowed.status}`);

  db.updateSecurity({
    readOnly: { enabled: false },
  });
  console.log('  [OK] Restored write access');
}

async function demoDashboardStatus(db: SQLDashboard): Promise<void> {
  heading('19. DASHBOARD STATUS');

  const info = await db.status();
  console.log(`  Connected:    ${info.connected}`);
  console.log(`  Driver:       ${info.driver}`);
  console.log(`  Version:      ${info.version}`);
  console.log(`  Uptime:       ${info.uptime.toFixed(1)}s`);
  console.log(`  DB Version:   ${info.databaseVersion}`);
  console.log(`  History:      ${info.history.total} total, ${info.history.successful} ok, ${info.history.failed} failed`);

  subheading('Driver version');
  const driverVer = await db.getDriverVersion();
  console.log(`  ${driverVer}`);

  subheading('List databases');
  const databases = await db.getDatabases();
  console.log(`  ${databases.join(', ')}`);
}

async function demoCreateDashboardFactory(): Promise<void> {
  heading('20. createDashboard() FACTORY');

  const db = createDashboard({
    driver: { type: DriverType.SQLITE, connection: { mode: 'memory' } },
    logger: { level: 'silent' },
    autoConnect: false,
  });

  await db.connect();
  const s = await db.status();
  console.log(`  [OK] Factory created dashboard: version ${s.version}, driver ${s.driver}`);
  db.destroy();
  console.log('  [OK] Cleanup done');
}

async function main(): Promise<void> {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║         SQL-Dashboard  v1.0.0  -  Feature Demo          ║
  ║  SQL management dashboard for admin panels               ║
  ╚══════════════════════════════════════════════════════════╝`);

  let db: SQLDashboard | null = null;

  try {
    db = await demoBasicSetup();
    await demoTableCreation(db);
    await demoQueryExecution(db);
    await demoTransaction(db);
    await demoBatchQueries(db);
    await demoSchemaBrowsing(db);
    await demoViews(db);
    await demoExplainAnalyze(db);
    await demoQueryHistory(db);
    await demoExport(db);
    await demoValidation(db);
    await demoFormatting();
    await demoInjectionDetection();
    await demoSecurityFeatures();
    await demoUtilities();
    await demoEventSystem(db);
    await demoErrorHandling(db);
    await demoUpdateSecurity(db);
    await demoDashboardStatus(db);
    await demoCreateDashboardFactory();

    heading('ALL FEATURES DEMONSTRATED SUCCESSFULLY');
    console.log('  The sql-dashboard package provides a complete SQL management solution.');
    console.log('  Visit https://github.com/Karan-Safaie-Qadi/sql-dashboard for more info.\n');

  } catch (err) {
    console.error(`\n  [FATAL] ${(err as Error).message}`);
    console.error(err);
    process.exit(1);
  } finally {
    if (db) db.destroy();
  }
}

main();
