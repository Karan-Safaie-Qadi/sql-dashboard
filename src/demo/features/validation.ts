import { SQLDashboard } from '../../engine';
import { validateQuery, detectStatementType, isReadOnlyStatement } from '../../core/validator';
import { detectInjection, sanitizeIdentifier } from '../../core/sanitizer';
import { formatSQL, formatResultRow } from '../../core/formatter';

export async function demoValidation(db: SQLDashboard): Promise<void> {
  const samples = [
    'SELECT * FROM users',
    'DROP TABLE users',
    'DELETE FROM users',
    'SELECT * FROM users WHERE 1=1',
  ];
  for (const sql of samples) {
    const v = validateQuery(sql, db.config.security);
    console.log(`  [${v.valid ? 'VALID' : 'INVALID'}] ${sql.substring(0, 40)} - ${v.errors.map(e => e.message).join('; ')}`);
  }

  const types = ['SELECT * FROM users', 'INSERT INTO users VALUES (1)', 'UPDATE users SET name=? WHERE id=?', 'DELETE FROM users WHERE id=?', 'CREATE TABLE t (id INT)', 'DROP TABLE users'];
  for (const sql of types) {
    console.log(`  ${detectStatementType(sql).padEnd(10)} ${sql}`);
  }

  const injections = [
    'SELECT * FROM users WHERE id = 1 OR 1=1',
    'SELECT * FROM users; DROP TABLE users;',
    'SELECT * FROM users WHERE name = \'\' OR \'1\'=\'1\'',
  ];
  for (const sql of injections) {
    console.log(`  [${detectInjection(sql) ? 'MALICIOUS' : 'SAFE'}] ${sql.substring(0, 50)}`);
  }

  const dirty = ['bad table', '123name', 'drop;all'];
  for (const n of dirty) {
    console.log(`  sanitize: "${n}" -> "${sanitizeIdentifier(n)}"`);
  }

  const ugly = 'select u.id,count(*) from users u where u.active=1 group by u.id having count(*)>0 order by u.id';
  console.log(`  Formatted:\n    ${formatSQL(ugly, { uppercase: true }).split('\n').join('\n    ')}`);

  const row = { id: 1, name: 'Alice', data: Buffer.from('test') };
  console.log(`  formatResultRow: ${JSON.stringify(formatResultRow(row))}`);
}
