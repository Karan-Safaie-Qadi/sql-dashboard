import { SQLDashboard } from '../../engine';

export async function demoTransactions(db: SQLDashboard): Promise<void> {
  const result = await db.transaction(async (query) => {
    await query("INSERT INTO users (name, email, role) VALUES ('Tx User', 'tx@test.com', 'user')");
    const count = await query('SELECT COUNT(*) as c FROM users');
    return `User added, total ${JSON.stringify(count.rows[0].c)}`;
  });
  console.log(`  Transaction OK: ${result}`);

  try {
    await db.transaction(async (query) => {
      await query("INSERT INTO users (name, email, role) VALUES ('Rollback', 'rb@test.com', 'user')");
      await query('INSERT INTO nonexistent VALUES (1)');
    });
  } catch {
    const check = await db.query("SELECT COUNT(*) as c FROM users WHERE email = 'rb@test.com'");
    console.log(`  Rollback verified: user present = ${check.rows[0].c === 0}`);
  }
}

export async function demoBatchQueries(db: SQLDashboard): Promise<void> {
  const results = await db.batch([
    'SELECT COUNT(*) as u FROM users',
    'SELECT COUNT(*) as p FROM posts',
    'SELECT COUNT(*) as c FROM comments',
  ]);
  for (const r of results) {
    console.log(`  Batch: ${JSON.stringify(r.rows[0])} (${r.duration.toFixed(1)}ms)`);
  }

  const multi = await db.executeBatch('SELECT 1 as a; SELECT 2 as b;');
  console.log(`  executeBatch: ${multi.length} queries`);
}
