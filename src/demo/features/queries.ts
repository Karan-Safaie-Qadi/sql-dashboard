import { SQLDashboard } from '../../engine';

export async function demoQueries(db: SQLDashboard): Promise<void> {
  const r1 = await db.query('SELECT id, name, email, role FROM users');
  console.log(`  Simple SELECT: ${r1.rowCount} rows in ${r1.duration.toFixed(2)}ms`);

  const r2 = await db.query('SELECT id, name, email FROM users WHERE role = ?', { params: ['editor'] });
  console.log(`  Parameterized: ${r2.rowCount} editors found`);

  const r3 = await db.query(`SELECT p.id, p.title, u.name as author FROM posts p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC`);
  console.log(`  JOIN: ${r3.rowCount} posts with authors`);

  const r4 = await db.query(`SELECT u.role, COUNT(DISTINCT u.id) as users, COUNT(p.id) as posts FROM users u LEFT JOIN posts p ON p.user_id = u.id GROUP BY u.role`);
  for (const row of r4.rows) {
    console.log(`  GROUP BY: role=${row.role}, users=${row.users}, posts=${row.posts}`);
  }

  const r5 = await db.query('SELECT * FROM users', { maxRows: 2 });
  console.log(`  maxRows=2: ${r5.rowCount} rows (${r5.warning ? 'truncated' : 'full'})`);
}
